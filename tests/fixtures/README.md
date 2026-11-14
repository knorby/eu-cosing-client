# Test fixtures

Excerpts from the European Commission's CosIng annex CSV exports, captured
**read-only on 2026-10-03** from the public export API
(`https://api.tech.ec.europa.eu/cosing20/1.0/api/annexes/{II,III,IV,V,VI}/export-csv`).

Each file is a small, representative excerpt of the corresponding live
export: the full preamble (file creation date, annex name + last-update
date, title, section header) plus selected data rows exercising tricky
shapes — quoted fields with embedded newlines, `" / "`- and `;`-joined
multi-identifier CAS/EC strings, `-` absent values, lettered reference
numbers.

- `annex-ii.csv` — rows 1, 2, 4 (prohibited substances)
- `annex-iii.csv` — rows 376, 377 (restricted substances; retinol entry
  with multiline conditions and `;`-joined identifiers)
- `annex-iv.csv` — row 1 (colorant with colour index)
- `annex-v.csv` — row 1a (preservative; twelve unevenly-spaced CAS/EC)
- `annex-vi.csv` — row 2 (UV filter)

The underlying data is © the European Commission (EU reuse notice: CC BY
4.0). These excerpts are used solely for offline testing of this client and
are **not** shipped in the published package. If the Commission would
prefer they not be committed here, contact the repository owner and they
will be replaced with synthetic fixtures.
