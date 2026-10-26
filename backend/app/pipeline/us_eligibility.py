"""Decide whether a job is a remote role a US-based candidate may take.

Eligible scopes:
  us            remote, US only
  us_canada     remote, US and/or Canada
  worldwide     remote, anywhere
  europe_us     European posting that explicitly names US candidates too

Everything else (on-site, hybrid, a non-US country or region only) is rejected with a reason.
The rules are conservative: when the text does not clearly allow US candidates, the job is rejected.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

from app.services.ai_pipeline import WORLDWIDE, job_countries

_REMOTE = re.compile(r"\b(remote|distributed|work from (home|anywhere)|anywhere|worldwide|telecommut\w*)\b", re.I)
_OTHER_REGION = re.compile(r"\b(apac|latam|asia|africa|middle east|south america|oceania|anz)\b", re.I)
_ONSITE_ONLY = re.compile(r"\b(on-?site|in[- ]office|hybrid)\b", re.I)
_US_NAMES = re.compile(
    r"\b(united states|u\.?s\.?a\.?|u\.s\.?|us|america|north america|usca|us/canada|us & canada)\b", re.I
)
_US_STATE_OR_CITY = re.compile(
    r",\s*(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC)\b"
)

# Phrases that shut US candidates out, wherever they appear in the posting.
_EXCLUDED = re.compile(
    r"(not (open|available|eligible) (to|for) (candidates|applicants)? ?(in|from|based in) (the )?(us|u\.s\.|united states)|"
    r"(must|should) (reside|be (based|located|resident)|live) in (the )?(eu|european union|uk|united kingdom|emea|europe|germany|france|spain|poland|portugal|netherlands|ireland|india|brazil)|"
    r"\b(eu|uk|emea|apac|latam|europe|european)[- ](only|residents only|based only)\b|"
    r"no (us|u\.s\.) (candidates|applicants)|"
    r"unable to (hire|employ|sponsor).{0,40}(in the )?(us|united states))",
    re.I,
)
_US_OPEN = re.compile(
    r"(open to (candidates|applicants|people)?\s*(located |based |residing )?(in|from) (the )?(us|u\.s\.|united states)|"
    r"(us|united states)( or | and |, | / )(canada|europe|eu|uk)|"
    r"(europe|eu|uk|emea)( or | and |, | / )(us|united states|north america|americas)|"
    r"eligible to work in the (us|united states)|"
    r"(us|united states|north america) time ?zones?)",
    re.I,
)
_EUROPE = re.compile(
    r"\b(europe|european|eu|emea|uk|united kingdom|germany|france|spain|portugal|poland|netherlands|ireland|italy|"
    r"sweden|norway|denmark|finland|belgium|austria|switzerland|romania|czech|serbia|slovenia|ukraine)\b",
    re.I,
)
_NON_US_COUNTRIES = {
    "United Kingdom", "India", "Germany", "France", "Netherlands", "Ireland", "Singapore", "Australia", "Japan",
    "South Korea", "Spain", "Brazil", "Mexico", "Poland", "Sweden", "Israel", "Serbia", "Switzerland", "Norway",
    "Iceland", "Argentina", "Peru", "Turkey", "Vietnam", "Taiwan", "Italy", "Portugal", "Belgium", "Austria",
    "Denmark", "Finland", "Czech Republic", "Romania", "Ukraine", "China", "Hong Kong", "United Arab Emirates",
    "New Zealand", "Indonesia", "Philippines", "Thailand", "Colombia", "Chile", "Costa Rica", "Slovenia",
}
_EUROPEAN_COUNTRIES = {
    "United Kingdom", "Germany", "France", "Netherlands", "Ireland", "Spain", "Poland", "Sweden", "Serbia",
    "Switzerland", "Norway", "Iceland", "Italy", "Portugal", "Belgium", "Austria", "Denmark", "Finland",
    "Czech Republic", "Romania", "Ukraine", "Slovenia",
}


@dataclass(frozen=True)
class Eligibility:
    eligible: bool
    scope: str  # us | us_canada | worldwide | europe_us | rejected
    reason: str
    countries: tuple[str, ...] = ()


def _reject(reason: str, countries: list[str] | None = None) -> Eligibility:
    return Eligibility(False, "rejected", reason, tuple(countries or ()))


def classify(
    location: str,
    *,
    workplace_type: str | None = None,
    is_remote: bool | None = None,
    title: str = "",
    description: str = "",
    secondary_locations: list[str] | None = None,
    country_codes: list[str] | None = None,
) -> Eligibility:
    """Classify one posting. `description` is plain text; only the first 4,000 characters are read."""
    location = (location or "").strip()
    extra = [s.strip() for s in (secondary_locations or []) if s and s.strip()]
    place = " | ".join([location, *extra]).strip(" |")
    wtype = (workplace_type or "").strip().lower()
    desc = (description or "")[:4000]

    # 1. Remote only.
    if wtype in {"onsite", "on-site", "on_site", "hybrid"} or is_remote is False:
        return _reject("not remote")
    remote = wtype == "remote" or is_remote is True or bool(_REMOTE.search(place)) or bool(_REMOTE.search(title))
    if not remote:
        return _reject("not remote")
    if _ONSITE_ONLY.search(place) and wtype != "remote":
        return _reject("hybrid or on-site")

    # 2. Explicit exclusions in the location or the posting.
    if _EXCLUDED.search(place) or _EXCLUDED.search(desc):
        return _reject("posting excludes US candidates")

    codes = {c.upper() for c in (country_codes or []) if c}
    countries = job_countries(place, title)
    if codes & {"US", "USA"} and "United States" not in countries:
        countries.append("United States")
    if "CA" in codes and "Canada" not in countries:
        countries.append("Canada")

    us = "United States" in countries or bool(_US_NAMES.search(place)) or bool(_US_STATE_OR_CITY.search(place))
    canada = "Canada" in countries

    # 3. Worldwide.
    if WORLDWIDE in countries and not (set(countries) - {WORLDWIDE}):
        if not us and (_EUROPE.search(place) or _OTHER_REGION.search(place)):
            if _EUROPE.search(place) and (_US_OPEN.search(desc) or _US_OPEN.search(place)):
                return Eligibility(True, "europe_us", "european posting open to US candidates", tuple(countries))
            return _reject("regional posting without explicit US eligibility", countries)
        return Eligibility(True, "worldwide", "remote, open worldwide", tuple(countries))

    # 4. US and/or Canada named.
    if us and canada:
        return Eligibility(True, "us_canada", "remote, US and Canada", tuple(countries))
    if us:
        others = [c for c in countries if c in _EUROPEAN_COUNTRIES]
        if others:
            return Eligibility(True, "europe_us", "european posting that names the US", tuple(countries))
        return Eligibility(True, "us", "remote, US", tuple(countries))
    if canada:
        return Eligibility(True, "us_canada", "remote, Canada", tuple(countries))

    # 5. Europe (or any other region) only when US candidates are named explicitly.
    european = bool(set(countries) & _EUROPEAN_COUNTRIES) or bool(_EUROPE.search(place))
    if european or set(countries) & _NON_US_COUNTRIES:
        if european and (_US_OPEN.search(desc) or _US_OPEN.search(place)):
            return Eligibility(True, "europe_us", "european posting open to US candidates", tuple(countries))
        return _reject("non-US region without explicit US eligibility", countries)

    # 6. Generic "Remote" with no place at all.
    if not countries:
        return Eligibility(True, "worldwide", "remote, no location restriction", (WORLDWIDE,))
    return _reject("unrecognised region", countries)
