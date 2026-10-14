import os
import sys
import uuid
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pymupdf
from backend.app.ocr.engine import OCREngine
from backend.app.extraction.classifier import classify_document
from backend.app.extraction.service import extract_structured_fields

folder = r"C:\Users\Yashesh\Downloads\REVIEW"
if not os.path.exists(folder):
    print(f"Directory {folder} does not exist")
    exit(1)

files = sorted([f for f in os.listdir(folder) if f.endswith(".pdf") or f.endswith(".jpg")])

print(f"=== EVALUATING {len(files)} FILES IN {folder} ===\n")

for fname in files:
    path = os.path.join(folder, fname)
    with open(path, "rb") as f:
        content = f.read()

    mime_type = "image/jpeg" if fname.endswith(".jpg") else "application/pdf"
    pages = OCREngine.extract_document(content=content, mime_type=mime_type)
    full_text = "\n".join([p.text for p in pages])

    category, conf = classify_document(text=full_text, filename=fname, declared_category="supporting_evidence")

    fields = extract_structured_fields(
        document_id=uuid.uuid4(),
        organization_id=uuid.uuid4(),
        category=category,
        pages=pages,
        document_bytes=content,
        mime_type=mime_type,
        filename=fname,
    )

    print(f"File: {fname}")
    print(f"  Classified Category: {category} (conf: {conf:.2f})")
    print(f"  Pages: {len(pages)} | Text Length: {len(full_text)} chars")
    print(f"  Fields Extracted ({len(fields)}):")
    for fld in fields[:6]:
        print(f"    - {fld.field_name} ({fld.field_label}): \"{fld.normalized_value}\" [conf: {fld.extraction_confidence}]")
    if len(fields) > 6:
        print(f"    ... and {len(fields)-6} more fields")
    if len(fields) == 0:
        print("    [!] FAILED: ZERO FIELDS EXTRACTED")
    print("-" * 70)
