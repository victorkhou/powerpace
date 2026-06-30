"""The coach agent — Phase 2: an explicit LangGraph StateGraph.

Phase 1 used create_react_agent, which hid the loop. Here we hand-build the same
loop from primitives so the mechanics are visible. The graph is:

        ┌───────┐   tools_condition    ┌───────┐
  START │ agent │ ───────────────────▶ │ tools │
        └───────┘ ◀─────────────────── └───────┘
            │  (model returned tool calls → run them → feed results back)
            │  (model returned a plain answer → no tool calls)
            ▼
           END

Four concepts to learn here:
  1. State        — a TypedDict the graph threads through every node. `messages`
                    uses the add_messages reducer so each node APPENDS rather than
                    overwrites the conversation.
  2. Nodes        — `agent` (calls the model) and `tools` (executes tool calls).
  3. Conditional  — tools_condition inspects the last message: if it has tool
     edge          calls, route to `tools`; otherwise route to END.
  4. Checkpointer — MemorySaver persists state per thread_id, giving multi-turn
                    memory for free (the graph reloads prior messages by thread).
"""
from typing import Annotated, TypedDict

from langchain.chat_models import init_chat_model
from langchain_core.messages import AnyMessage, SystemMessage
from langgraph.checkpoint.memory import MemorySaver
from langgraph.errors import GraphRecursionError
from langgraph.graph import END, START, StateGraph
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode, tools_condition

from .config import settings
from .tools import build_tools

SYSTEM_PROMPT = (
    "You are a strength-training coach for a Texas Method-style program. "
    "Answer questions about the user's training using the provided tools — never "
    "guess numbers. Progression rules: linear progression adds weight on success; "
    "3 consecutive failures triggers a ~5% deload. When you cite a number (a PR, a "
    "weight, a volume), it must come from a tool call. Be concise and concrete."
)


class CoachState(TypedDict):
    """State threaded through the graph.

    The Annotated[..., add_messages] reducer is the important bit: when a node
    returns {"messages": [...]}, LangGraph APPENDS those to the existing list
    (and dedupes by id) instead of replacing it. That's what lets the loop
    accumulate user → assistant(tool_calls) → tool results → assistant(answer).
    """
    messages: Annotated[list[AnyMessage], add_messages]


# A single in-process checkpointer shared across requests. Keyed by thread_id,
# so two users (or two conversations) never see each other's history.
# NOTE: MemorySaver is in-memory only — it resets when the sidecar restarts.
# Swap for a persistent checkpointer (e.g. langgraph SqliteSaver/PostgresSaver)
# when you want memory to survive restarts.
_checkpointer = MemorySaver()


def build_coach(user_id: str):
    """Compile a coach graph for one user.

    The model and tools are the SAME as Phase 1 — only the orchestration is now
    explicit. init_chat_model(settings.coach_model) keeps the provider swap
    (Phase 4) a one-string change; bind_tools tells the model which tools exist.

    The model is bounded: max_tokens caps per-response output, and timeout caps
    how long a single model call may hang (so a wedged upstream can't pin a
    worker forever). Both are configurable in config.py.
    """
    tools = build_tools(user_id)
    model = init_chat_model(
        settings.coach_model,
        max_tokens=settings.coach_max_tokens,
        timeout=settings.coach_request_timeout,
    ).bind_tools(tools)

    def agent_node(state: CoachState) -> dict:
        """The reasoning node: prepend the system prompt, call the model, return
        its message. The model decides whether to emit tool calls or a final answer."""
        messages = [SystemMessage(SYSTEM_PROMPT), *state["messages"]]
        response = model.invoke(messages)
        return {"messages": [response]}

    # ToolNode runs whatever tool calls are on the last AI message and returns
    # the results as ToolMessages — the manual equivalent of the Phase 1 loop body.
    tool_node = ToolNode(tools)

    graph = StateGraph(CoachState)
    graph.add_node("agent", agent_node)
    graph.add_node("tools", tool_node)
    graph.add_edge(START, "agent")
    # tools_condition: if the last message has tool_calls → "tools", else → END.
    graph.add_conditional_edges("agent", tools_condition)
    graph.add_edge("tools", "agent")  # after running tools, loop back to reason again

    return graph.compile(checkpointer=_checkpointer)


class CoachLimitError(RuntimeError):
    """Raised when a turn exceeds the agent<->tools recursion limit — i.e. the
    model kept calling tools without converging. Callers should surface a
    graceful message rather than a 500."""


async def ask(user_id: str, question: str, thread_id: str | None = None) -> str:
    """Run one turn through the graph.

    thread_id selects the conversation. Reusing a thread_id replays that thread's
    saved state (multi-turn memory); a new one starts fresh. We default it to the
    user_id so a given user has one rolling conversation until you pass something
    else (e.g. a per-chat-session id).

    recursion_limit caps how many agent<->tools hops one turn may take. Without it,
    a model that loops on tool calls would run up to LangGraph's default (25) — ~25
    uncapped paid model calls — before erroring. We bound it and translate the
    overflow into a typed CoachLimitError.
    """
    agent = build_coach(user_id)
    config = {
        "configurable": {"thread_id": thread_id or user_id},
        "recursion_limit": settings.coach_recursion_limit,
    }
    try:
        result = await agent.ainvoke(
            {"messages": [{"role": "user", "content": question}]},
            config,
        )
    except GraphRecursionError as exc:
        raise CoachLimitError(
            "The coach couldn't converge on an answer within its step budget."
        ) from exc
    return result["messages"][-1].content
