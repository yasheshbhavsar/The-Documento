import type { Metadata } from "next";
import { DocumentExtractorLab } from "../../components/tools/DocumentExtractorLab";

export const metadata: Metadata = {
  title: "AI Document Recognition & Information Extractor | Documento",
  description:
    "Standalone test lab for Documento OCR engine, document taxonomy classification, entity extraction provenance, and evidence forensics. Zero login required.",
};

export default function ExtractorPage() {
  return <DocumentExtractorLab />;
}
