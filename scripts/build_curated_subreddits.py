#!/usr/bin/env python3
"""Build readout/data/curated_subreddits.json from hand-curated list + RedditJS directory."""

import json
import re
import sys
from pathlib import Path

import httpx

# Hand-curated from user paste (r/Name (17M) or r/Name)
CURATED_RAW = """
r/InternetIsBeautiful (17M)
r/Entrepreneur (4.8M)
r/productivity (4M)
r/business (2.5M)
r/smallbusiness (2.2M)
r/startups (2.0M)
r/passive_income (1.0M)
r/EntrepreneurRideAlong (593K)
r/SideProject (430K)
r/Business_Ideas (359K)
r/SaaS (341K)
r/startup (267K)
r/Startup_Ideas (241K)
r/thesidehustle (184K)
r/juststart (170K)
r/MicroSaas (155K)
r/ycombinator (132K)
r/Entrepreneurs (110K)
r/indiehackers (91K)
r/GrowthHacking (77K)
r/AppIdeas (74K)
r/growmybusiness (63K)
r/buildinpublic (55K)
r/micro_saas (52K)
r/Solopreneur (43K)
r/vibecoding (35K)
r/startup_resources (33K)
r/indiebiz (29K)
r/AlphaandBetaUsers (21K)
r/scaleinpublic (11K)
r/learnprogramming
r/degoogle
r/coding
r/technology
r/tech
r/realtech
r/Computing
r/windows
r/Apple
r/Mac
r/Linux
r/Ubuntu
r/Chromium
r/WinTiles
r/windowsazure
r/Mobile
r/Android
r/ios
r/iphone
r/Blackberry
r/WindowsPhone
r/symbian
r/UbuntuPhone
r/meego
r/nokia
r/ipad
r/Surface
r/gaming
r/Games
r/pcgaming
r/Steam
r/SteamBox
r/lanparty
r/LowEndGaming
r/PatientGamers
r/xbox
r/xboxone
r/xbox360
r/XboxLive
r/playstation
r/PS4
r/Vita
r/VitaTV
r/PS3
r/PlayStationPlus
r/nintendo
r/wii
r/wiiu
r/3ds
r/nds
r/iosgaming
r/Gadgets
r/ipod
r/Zune
r/GoogleGlass
r/bitcoin
r/BitcoinMarkets
r/CryptoMarkets
r/Kickstarter
r/webmarketing
r/seo
r/bigseo
r/dotcom
r/Information_Assurance
r/techsupport
r/24hoursupport
r/Applehelp
r/linux4noobs
r/pcgamingtechsupport
r/asktechnology
r/techolitics
r/netsec
r/netneutrality
r/talesfromtechsupport
r/technologymeta
r/CSEducation
r/cscareerquestions
r/GameDealsMeta
r/computertechs
r/Sysadmin
r/Hardware
r/Hardwarenews
r/buildapc
r/networking
r/intel
r/nvidia
r/amd
r/datacenter
r/monitors
r/mechanicalkeyboards
r/MouseReview
r/TrackBalls
r/freewareindex
r/CAD
r/AutoCAD
r/programming
r/redditdev
r/compsci
r/Software
r/dailyprogrammer
r/dailyscripts
r/webdev
r/gamedev
r/web_design
r/userexperience
r/firefox
r/Chrome
r/internetexplorer
r/TechnologyPorn
r/battlestations
r/techsupportgore
r/softwaregore
r/techsupportmacgyver
r/ImaginaryTechnology
r/buildapcsales
r/suggestalaptop
r/gamedeals
r/gameoffers
r/AppHookup
r/SteamGameSwap
r/ShouldIbuythisgame
r/Futurology
r/RenewableEnergy
r/Engineering
r/Geek
r/airz23
r/computing
r/cybersecurity
r/hacking
r/ITCareerQuestions
r/TheWorldDaily
"""

REDDITJS_URL = "https://raw.githubusercontent.com/BenjaminAdams/RedditJS/master/public/data/subredditList.json"


def _parse_count(s: str) -> int | None:
    s = s.strip().upper().replace(",", "")
    if not s:
        return None
    mult = 1
    if s.endswith("M"):
        mult = 1_000_000
        s = s[:-1]
    elif s.endswith("K"):
        mult = 1_000
        s = s[:-1]
    try:
        return int(float(s) * mult)
    except ValueError:
        return None


def _parse_curated() -> list[dict]:
    seen: dict[str, dict] = {}
    for line in CURATED_RAW.splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        name_match = re.match(r"r/([A-Za-z0-9_]+)", line)
        if not name_match:
            continue
        name = name_match.group(1)
        count_match = re.search(r"\(([0-9.,]+[KkMm]?)\)", line)
        subscribers = _parse_count(count_match.group(1)) if count_match else None
        key = name.lower()
        if key not in seen or subscribers is not None:
            seen[key] = {"name": name, "subscribers": subscribers}
    return list(seen.values())


def _fetch_redditjs() -> list[str]:
    try:
        r = httpx.get(REDDITJS_URL, timeout=15)
        r.raise_for_status()
        data = r.json()
    except Exception as e:
        print("RedditJS fetch failed:", e, file=sys.stderr)
        return []
    names: list[str] = []
    for category_subs in data.values():
        if isinstance(category_subs, list):
            for s in category_subs:
                if isinstance(s, str) and s.strip():
                    names.append(s.strip())
    return names


def main() -> None:
    repo_root = Path(__file__).resolve().parent.parent
    out_path = repo_root / "readout" / "data" / "curated_subreddits.json"

    curated = _parse_curated()
    by_name: dict[str, dict] = {s["name"].lower(): s for s in curated}

    extra = _fetch_redditjs()
    for name in extra:
        key = name.lower()
        if key not in by_name:
            by_name[key] = {"name": name, "subscribers": None}

    out_list = list(by_name.values())
    out_list.sort(key=lambda x: (x.get("subscribers") or 0, x["name"].lower()), reverse=True)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w") as f:
        json.dump(out_list, f, indent=2)

    print(f"Wrote {len(out_list)} subreddits to {out_path}")


if __name__ == "__main__":
    main()
