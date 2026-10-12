import re
from datetime import datetime
from typing import Optional


COUNTRY_ISO3_MAP: dict[str, str] = {
    "UNITED STATES": "USA",
    "UNITED STATES OF AMERICA": "USA",
    "U.S.A.": "USA",
    "USA": "USA",
    "US": "USA",
    "UNITED KINGDOM": "GBR",
    "GREAT BRITAIN": "GBR",
    "BRITAIN": "GBR",
    "UK": "GBR",
    "GBR": "GBR",
    "CANADA": "CAN",
    "CAN": "CAN",
    "AUSTRALIA": "AUS",
    "AUS": "AUS",
    "UKRAINE": "UKR",
    "UKR": "UKR",
    "INDIA": "IND",
    "IND": "IND",
    "JAPAN": "JPN",
    "JPN": "JPN",
    "GERMANY": "DEU",
    "DEU": "DEU",
    "FRANCE": "FRA",
    "FRA": "FRA",
    "CHINA": "CHN",
    "CHN": "CHN",
    "UNITED ARAB EMIRATES": "ARE",
    "UAE": "ARE",
    "ARE": "ARE",
    "SINGAPORE": "SGP",
    "SGP": "SGP",
}


def normalize_date(raw_date_str: str) -> Optional[str]:
    """
    Normalizes various human date formats into standard ISO 8601 (YYYY-MM-DD).
    Returns None if date could not be unambiguously parsed.
    """
    if not raw_date_str:
        return None

    cleaned = raw_date_str.strip().upper()
    # Remove ordinal suffixes: 1st, 2nd, 3rd, 4th
    cleaned = re.sub(r"(\d+)(ST|ND|RD|TH)", r"\1", cleaned)

    # Common date formats
    formats = [
        "%Y-%m-%d",
        "%d/%m/%Y",
        "%m/%d/%Y",
        "%d-%m-%Y",
        "%Y/%m/%d",
        "%d %B %Y",
        "%d %b %Y",
        "%B %d, %Y",
        "%b %d, %Y",
        "%d %B, %Y",
        "%d%b%Y",
        "%d%B%Y",
    ]

    for fmt in formats:
        try:
            dt = datetime.strptime(cleaned, fmt)
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            continue

    # MRZ date format (YYMMDD)
    if re.fullmatch(r"\d{6}", cleaned):
        try:
            year_prefix = "19" if int(cleaned[:2]) > 30 else "20"
            full_year = f"{year_prefix}{cleaned[:2]}"
            dt = datetime.strptime(f"{full_year}-{cleaned[2:4]}-{cleaned[4:6]}", "%Y-%m-%d")
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            pass

    return None


def normalize_country(raw_country: str) -> Optional[str]:
    """
    Normalizes country names or partial references into standard ISO 3166-1 alpha-3 code.
    """
    if not raw_country:
        return None

    clean = raw_country.strip().upper()
    # Direct dictionary lookup
    if clean in COUNTRY_ISO3_MAP:
        return COUNTRY_ISO3_MAP[clean]

    # Partial / substring matching
    for key, iso3 in COUNTRY_ISO3_MAP.items():
        if key in clean:
            return iso3

    if len(clean) == 3 and clean.isalpha():
        return clean

    return clean


def normalize_currency_amount(raw_amount: str) -> Optional[str]:
    """
    Normalizes currency strings into standard '<Decimal> <CurrencyCode>' representation.
    e.g. '$185,000.00 / year' -> '185000.00 USD'
    """
    if not raw_amount:
        return None

    cleaned = raw_amount.strip()
    currency = "USD"
    if "£" in cleaned or "GBP" in cleaned:
        currency = "GBP"
    elif "€" in cleaned or "EUR" in cleaned:
        currency = "EUR"
    elif "CAD" in cleaned or "C$" in cleaned:
        currency = "CAD"
    elif "AUD" in cleaned or "A$" in cleaned:
        currency = "AUD"
    elif "¥" in cleaned or "JPY" in cleaned:
        currency = "JPY"
    elif "₹" in cleaned or "INR" in cleaned:
        currency = "INR"

    # Extract numerical digits and decimal point
    digits = re.search(r"[\d,]+(?:\.\d{1,2})?", cleaned)
    if digits:
        val = digits.group(0).replace(",", "")
        try:
            num = float(val)
            return f"{num:.2f} {currency}"
        except ValueError:
            pass

    return None
