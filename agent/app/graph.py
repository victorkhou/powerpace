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
from langchain_core.messages import AIMessage, AnyMessage, HumanMessage, SystemMessage, ToolMessage
from langgraph.checkpoint.memory import MemorySaver
from langgraph.errors import GraphRecursionError
from langgraph.graph import END, START, StateGraph
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode, tools_condition

from . import groundedness
from .config import settings
from .tools import build_tools

SYSTEM_PROMPT = (
    "You are a strength-training coach for a Texas Method-style program. "
    "Answer questions about the user's training using the provided tools — never "
    "guess. Every number you state — a PR, weight, volume, date, increment, deload "
    "percentage, or volume percentage — MUST come from a tool result in this "
    "conversation. Do not recite progression rules from memory: call "
    "get_program_rules for the actual increments, deload threshold/formula, and "
    "this program's volume multiplier. If a tool has no data for something, say so "
    "rather than inventing a value. Be concise and concrete."
)


class CoachState(TypedDict):
    """State threaded through the graph.

    The Annotated[..., add_messages] reducer is the important bit: when a node
    returns {"messages": [...]}, LangGraph APPENDS those to the existing list
    (and dedupes by id) instead of replacing it. That's what lets the loop
    accumulate user → assistant(tool_calls) → tool results → assistant(answer).

    grounding_attempts counts how many times the verify node has sent the answer
    back for regeneration this turn — it bounds the verify↔agent loop.
    """
    messages: Annotated[list[AnyMessage], add_messages]
    grounding_attempts: int


# A single in-process checkpointer shared across requests. Keyed by thread_id,
# so two users (or two conversations) never see each other's history.
# NOTE: MemorySaver is in-memory only — it resets when the sidecar restarts.
# Swap for a persistent checkpointer (e.g. langgraph SqliteSaver/PostgresSaver)
# when you want memory to survive restarts.
_checkpointer = MemorySaver()

# The groundedness judge — cheap model (claude-haiku-4-5), built once on first use.
# Lazy so importing this module constructs no model (keeps tests/CI hermetic).
_judge_singleton = None


def _judge():
    global _judge_singleton
    if _judge_singleton is None:
        _judge_singleton = init_chat_model(settings.judge_model)
    return _judge_singleton


def build_coach(user_id: str, model_id: str | None = None):
    """Compile a coach graph for one user.

    The model and tools are the SAME as Phase 1 — only the orchestration is now
    explicit. init_chat_model(model_id) keeps the provider swap (Phase 4) a
    one-string change; bind_tools tells the model which tools exist.

    model_id overrides settings.coach_model for a single build — this is the seam
    Phase 4's comparison harness uses to A/B two models (or two providers) through
    the exact same graph, tools, and prompt, with NO other code change. A
    provider-prefixed string ("anthropic:…", "openai:…") is all init_chat_model
    needs; everything downstream (tools, verify guard, eval) is provider-agnostic.

    The model is bounded: max_tokens caps per-response output, and timeout caps
    how long a single model call may hang (so a wedged upstream can't pin a
    worker forever). Both are configurable in config.py.
    """
    tools = build_tools(user_id)
    model = init_chat_model(
        model_id or settings.coach_model,
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

    def verify_node(state: CoachState) -> dict:
        """Inline groundedness guard. Runs after the agent produces a FINAL answer
        (no tool calls). Judges the answer against THIS turn's tool outputs; if it
        fabricated something, append a corrective instruction and bump the attempt
        counter so the routing edge sends it back to `agent` to redo the answer.

        Prompt instructions alone failed to stop the volume-trend hallucination —
        this is the structural backstop. The judge call adds latency only on final
        answers (once per turn), not on every tool hop."""
        answer = state["messages"][-1].content
        # Gather the tool outputs produced this turn — walk back to the last REAL
        # user message. Corrective messages injected by this node are tagged and
        # skipped; stopping at them was a blind spot where a regenerated answer
        # saw zero tool outputs and was accepted unverified (the retry answer is
        # exactly the one that most needs checking).
        tool_outputs: list[str] = []
        for msg in reversed(state["messages"][:-1]):
            if isinstance(msg, HumanMessage) and not msg.additional_kwargs.get("coach_correction"):
                break
            if isinstance(msg, ToolMessage):
                tool_outputs.append(str(msg.content))
        tool_outputs.reverse()

        # Nothing was retrieved → nothing to fabricate against; accept as-is.
        if not tool_outputs:
            return {}

        grounded, _verdict = groundedness.check(_judge(), answer, tool_outputs)
        attempts = state.get("grounding_attempts", 0)
        # Accept if grounded, OR if we've used up our retry budget (give up
        # gracefully and return the last attempt rather than looping forever).
        if grounded or attempts >= settings.coach_grounding_retries:
            return {}

        # Ungrounded and budget remains: push a corrective instruction and bump the
        # counter. after_verify will route back to `agent` to redo the answer.
        correction = HumanMessage(
            "Your previous answer included a figure or detail that is NOT in the "
            "tool results above. Re-answer using ONLY values present in those "
            "results. If a data point (e.g. a recent session) isn't there, do not "
            "invent it — say it isn't recorded.",
            # Tag so verify_node's tool-output walk skips this message instead of
            # treating it as the turn boundary (see comment above).
            additional_kwargs={"coach_correction": True},
        )
        return {"messages": [correction], "grounding_attempts": attempts + 1}

    def after_verify(state: CoachState) -> str:
        """Route out of verify: a trailing corrective HumanMessage means the answer
        was rejected with retry budget left → back to `agent`. Otherwise done.
        (verify_node only appends the correction when it intends to retry, so the
        final answer is always the last AI message when we reach END.)"""
        return "agent" if isinstance(state["messages"][-1], HumanMessage) else END

    graph = StateGraph(CoachState)
    graph.add_node("agent", agent_node)
    graph.add_node("tools", tool_node)
    graph.add_node("verify", verify_node)
    graph.add_edge(START, "agent")
    # After the agent: tool calls → "tools"; a final answer → "verify" (not END).
    graph.add_conditional_edges("agent", tools_condition, {"tools": "tools", END: "verify"})
    graph.add_edge("tools", "agent")  # after running tools, loop back to reason again
    graph.add_conditional_edges("verify", after_verify, {"agent": "agent", END: END})

    return graph.compile(checkpointer=_checkpointer)


class CoachLimitError(RuntimeError):
    """Raised when a turn exceeds the agent<->tools recursion limit — i.e. the
    model kept calling tools without converging. Callers should surface a
    graceful message rather than a 500."""


async def ask(user_id: str, question: str, thread_id: str | None = None,
              model_id: str | None = None) -> str:
    """Run one turn through the graph.

    thread_id selects the conversation. Reusing a thread_id replays that thread's
    saved state (multi-turn memory); a new one starts fresh. We default it to the
    user_id so a given user has one rolling conversation until you pass something
    else (e.g. a per-chat-session id).

    model_id overrides the coach model for this run (Phase 4 comparison harness);
    defaults to settings.coach_model — the normal /coach path passes nothing.

    recursion_limit caps how many agent<->tools hops one turn may take. Without it,
    a model that loops on tool calls would run up to LangGraph's default (25) — ~25
    uncapped paid model calls — before erroring. We bound it and translate the
    overflow into a typed CoachLimitError.
    """
    agent = build_coach(user_id, model_id)
    config = {
        "configurable": {"thread_id": thread_id or user_id},
        "recursion_limit": settings.coach_recursion_limit,
    }
    try:
        result = await agent.ainvoke(
            {"messages": [{"role": "user", "content": question}], "grounding_attempts": 0},
            config,
        )
    except GraphRecursionError as exc:
        raise CoachLimitError(
            "The coach couldn't converge on an answer within its step budget."
        ) from exc
    # Return the final assistant answer. After the verify loop the last message is
    # normally the AI answer, but scan from the end for the last AIMessage with
    # text content to be robust regardless of how the turn ended.
    for msg in reversed(result["messages"]):
        if isinstance(msg, AIMessage) and isinstance(msg.content, str) and msg.content.strip():
            return msg.content
    return result["messages"][-1].content
