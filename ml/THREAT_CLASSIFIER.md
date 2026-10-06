# Payload and upload threat classifier

`src/lib/threatClassifier.ts` adds the detection the paper claims beyond behaviour scoring:
SQL injection, XSS, path traversal, command injection (free-text inputs) and malicious uploads.

- **Method:** 13 regular-expression signatures for payloads (with percent-decoding) and rule checks for uploads:
  executable extension, double extension, control characters in the name, declared MIME vs extension,
  and executable magic bytes (MZ, ELF, #!) behind a document extension.
- **Where it runs:** share secret code / password inputs (`verifyFilePassword`, logged as a
  `suspicious_behavior` event with `threat_category`) and the upload dialog (rejects the file).
- **Evaluation:** `ml/threat_corpus.json` (made by `ml/make_threat_corpus.py`): 91 payload strings
  (51 attacks in 4 classes, 40 benign look-alikes) and 33 uploads (16 malicious, 17 benign).
  Result: payloads 90/91 correct (one SQL tautology in parenthesis form, `1) OR (1=1`, missed; one false
  positive none), uploads 33/33. Run: `npx vitest run src/test/threat-classifier.test.ts` (needs a plain
  node environment config; the repo's jsdom setup fails on Node 20.17).
- **Caveat:** the corpus was written by the authors from standard attack families, so it measures coverage
  of known patterns, not resistance to an adaptive attacker. It is signature-based, not machine learning;
  the paper must describe it as such.
