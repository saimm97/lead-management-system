import pytest

from app.pipeline.tech import detect_technologies, html_to_text, is_technical_job
from app.pipeline.us_eligibility import classify


@pytest.mark.parametrize(
    "kwargs, scope",
    [
        ({"location": "Remote - United States"}, "us"),
        ({"location": "Remote, USA"}, "us"),
        ({"location": "Austin, TX", "workplace_type": "remote"}, "us"),
        ({"location": "Remote - US or Canada"}, "us_canada"),
        ({"location": "Toronto, Canada", "workplace_type": "remote"}, "us_canada"),
        ({"location": "Worldwide"}, "worldwide"),
        ({"location": "Remote - Anywhere"}, "worldwide"),
        ({"location": "Remote"}, "worldwide"),
        ({"location": "Berlin", "workplace_type": "remote", "secondary_locations": ["New York"]}, "europe_us"),
        (
            {"location": "Remote - Europe", "description": "We are open to candidates in the US or Europe."},
            "europe_us",
        ),
    ],
)
def test_eligible_scopes(kwargs, scope):
    result = classify(**kwargs)
    assert result.eligible, result.reason
    assert result.scope == scope


@pytest.mark.parametrize(
    "kwargs",
    [
        {"location": "San Francisco, CA", "workplace_type": "onsite"},
        {"location": "Hybrid - New York"},
        {"location": "Remote - Europe"},
        {"location": "Remote - EMEA"},
        {"location": "Remote - India"},
        {"location": "Remote - APAC"},
        {"location": "Remote - Germany", "description": "Must reside in Germany."},
        {"location": "Remote - Poland", "description": "EU-only role."},
        {"location": "Remote", "description": "Not open to candidates in the US."},
        {"location": "London", "is_remote": False},
    ],
)
def test_rejected(kwargs):
    result = classify(**kwargs)
    assert not result.eligible
    assert result.scope == "rejected"
    assert result.reason


def test_country_codes_make_a_generic_remote_row_us():
    assert classify("Remote", country_codes=["US"]).eligible


def test_technical_title_filter():
    assert is_technical_job("Senior Backend Engineer")
    assert not is_technical_job("Sales Engineer")
    assert not is_technical_job("Technical Recruiter")


def test_html_to_text_and_technologies():
    body = "&lt;p&gt;Build services in Python and Django on AWS.&lt;/p&gt;&lt;ul&gt;&lt;li&gt;Python&lt;/li&gt;&lt;/ul&gt;"
    text = html_to_text(body)
    assert "<" not in text
    assert detect_technologies("Backend Engineer", text)[0] == "Python"
