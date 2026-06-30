"""Tool-layer tests. The db module is mocked — tools must return valid JSON
strings and the documented 'No data' fallback, with user_id correctly bound."""
import json
from unittest.mock import patch

from app import tools


def _get(tool_list, name):
    return next(t for t in tool_list if t.name == name)


def test_build_tools_returns_expected_toolset():
    names = {t.name for t in tools.build_tools("user-1")}
    assert names == {
        "get_personal_record", "get_recent_sessions",
        "get_progression_state", "get_volume_trend", "get_program_rules",
    }


def test_get_program_rules_returns_json():
    with patch.object(tools.db, "program_rules", return_value={"volume_pct": 0.9}):
        out = _get(tools.build_tools("u"), "get_program_rules").invoke({})
    assert json.loads(out)["volume_pct"] == 0.9


def test_get_personal_record_returns_json_on_hit():
    with patch.object(tools.db, "get_pr", return_value={"key": "bench", "pr_lbs": 157.5}):
        out = _get(tools.build_tools("user-1"), "get_personal_record").invoke({"lift_key": "bench"})
    assert json.loads(out)["pr_lbs"] == 157.5


def test_get_personal_record_no_data_fallback():
    with patch.object(tools.db, "get_pr", return_value=None):
        out = _get(tools.build_tools("user-1"), "get_personal_record").invoke({"lift_key": "bench"})
    assert out == "No data for lift 'bench'."


def test_tools_bind_user_id_from_closure():
    # The model never passes user_id; it must come from the closure, not args.
    with patch.object(tools.db, "get_recent_sessions", return_value=[]) as m:
        _get(tools.build_tools("user-XYZ"), "get_recent_sessions").invoke({"limit": 5})
    m.assert_called_once_with("user-XYZ", 5)


def test_list_tools_emit_valid_json():
    with patch.object(tools.db, "get_progression_state", return_value=[{"key": "squat"}]):
        out = _get(tools.build_tools("u"), "get_progression_state").invoke({})
    assert json.loads(out) == [{"key": "squat"}]
