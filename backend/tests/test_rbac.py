from backend.app.security.rbac import RoleCode, has_permission

def test_applicant_permissions_are_scoped():
    assert has_permission(RoleCode.APPLICANT, "case:read:own")
    assert not has_permission(RoleCode.APPLICANT, "case:write")

def test_rule_approval_is_separate_from_editing():
    assert has_permission(RoleCode.RULE_EDITOR, "rule:draft")
    assert not has_permission(RoleCode.RULE_EDITOR, "rule:publish")
    assert has_permission(RoleCode.RULE_APPROVER, "rule:publish")
