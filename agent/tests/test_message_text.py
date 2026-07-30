"""Tests for message_text — the content-block normalizer.

Anthropic returns content as EITHER a plain string OR a list of blocks
(text / tool_use). Assuming str silently produced empty answers, which is how
the first streaming implementation shipped a blank final answer and leaked
tool-call JSON. These pin both shapes.
"""
from types import SimpleNamespace

from app.graph import message_text


def test_plain_string_content():
    assert message_text(SimpleNamespace(content="hello")) == "hello"


def test_text_blocks_are_concatenated():
    msg = SimpleNamespace(content=[
        {"type": "text", "text": "Your PR is "},
        {"type": "text", "text": "157.5 lbs."},
    ])
    assert message_text(msg) == "Your PR is 157.5 lbs."


def test_tool_use_blocks_are_excluded():
    # Regression: tool_use blocks carry ids/inputs that must never surface as
    # answer text (the stream previously emitted "toolu_01..." to the user).
    msg = SimpleNamespace(content=[
        {"type": "text", "text": "Looking that up."},
        {"type": "tool_use", "id": "toolu_01ABC", "name": "get_personal_record", "input": {}},
    ])
    assert message_text(msg) == "Looking that up."
    assert "toolu_" not in message_text(msg)


def test_empty_and_missing_content():
    assert message_text(SimpleNamespace(content=[])) == ""
    assert message_text(SimpleNamespace()) == ""


def test_bare_string_items_in_list():
    assert message_text(SimpleNamespace(content=["a", "b"])) == "ab"


def test_non_dict_non_str_items_are_ignored():
    assert message_text(SimpleNamespace(content=[{"type": "text", "text": "ok"}, 42, None])) == "ok"
