#!/usr/bin/env python3
"""Generate a clean PDF report from cdk-nag CSV results."""

import csv
import os
from datetime import datetime

# We'll generate HTML and convert to PDF via a simple approach
# Using basic HTML-to-PDF with Python's built-in capabilities

REPORT_DIR = os.path.join(os.path.dirname(__file__), "..", "cdk.out")
OUTPUT_PATH = os.path.join(os.path.dirname(__file__), "..", "docs", "design-review", "cdk-nag-report.pdf")

STACKS = [
    "AwsSolutions-dev-security-agent-demo-backend-NagReport.csv",
    "AwsSolutions-dev-security-agent-demo-frontend-NagReport.csv",
    "AwsSolutions-dev-security-agent-demo-frontendDeployment-NagReport.csv",
    "AwsSolutions-dev-security-agent-demo-dns-NagReport.csv",
]

STACK_DISPLAY_NAMES = {
    "AwsSolutions-dev-security-agent-demo-backend-NagReport.csv": "Backend",
    "AwsSolutions-dev-security-agent-demo-frontend-NagReport.csv": "Frontend",
    "AwsSolutions-dev-security-agent-demo-frontendDeployment-NagReport.csv": "Frontend Deployment",
    "AwsSolutions-dev-security-agent-demo-dns-NagReport.csv": "DNS",
}


def parse_csv(filepath):
    rows = []
    with open(filepath, "r") as f:
        reader = csv.DictReader(f)
        for row in reader:
            rows.append(row)
    return rows


def shorten_resource(resource_id):
    """Shorten resource ID for readability."""
    parts = resource_id.split("/")
    # Remove the dev/stack-name prefix (first 2 segments)
    if len(parts) > 2:
        return "/".join(parts[2:])
    return resource_id


def generate_html():
    all_data = {}
    totals = {"Compliant": 0, "Suppressed": 0, "Non-Compliant": 0}

    for stack_file in STACKS:
        filepath = os.path.join(REPORT_DIR, stack_file)
        if not os.path.exists(filepath):
            continue
        rows = parse_csv(filepath)
        display_name = STACK_DISPLAY_NAMES.get(stack_file, stack_file)
        all_data[display_name] = rows
        for row in rows:
            status = row.get("Compliance", "")
            if status in totals:
                totals[status] += 1

    total_checks = sum(totals.values())
    non_compliant_details = []
    suppressed_details = []

    for stack_name, rows in all_data.items():
        for row in rows:
            entry = {
                "stack": stack_name,
                "rule": row["Rule ID"],
                "resource": shorten_resource(row["Resource ID"]),
                "level": row["Rule Level"],
                "info": row["Rule Info"],
                "reason": row.get("Exception Reason", "N/A"),
            }
            if row["Compliance"] == "Non-Compliant":
                non_compliant_details.append(entry)
            elif row["Compliance"] == "Suppressed":
                suppressed_details.append(entry)

    # Deduplicate non-compliant by (rule, resource)
    seen = set()
    unique_nc = []
    for e in non_compliant_details:
        key = (e["rule"], e["resource"])
        if key not in seen:
            seen.add(key)
            unique_nc.append(e)

    # Deduplicate suppressed by (rule, resource, reason)
    seen_s = set()
    unique_sup = []
    for e in suppressed_details:
        key = (e["rule"], e["resource"], e["reason"])
        if key not in seen_s:
            seen_s.add(key)
            unique_sup.append(e)

    timestamp = datetime.now().strftime("%B %d, %Y at %I:%M %p")

    html = f"""<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>CDK Nag Report — AWS Solutions Checks</title>
<style>
  @page {{ margin: 0.6in; size: letter; }}
  * {{ box-sizing: border-box; }}
  body {{
    font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif;
    font-size: 10px;
    color: #1a1a1a;
    line-height: 1.5;
    margin: 0;
    padding: 20px;
  }}
  .header {{
    border-bottom: 3px solid #232f3e;
    padding-bottom: 12px;
    margin-bottom: 20px;
  }}
  .header h1 {{
    font-size: 22px;
    color: #232f3e;
    margin: 0 0 4px 0;
  }}
  .header .subtitle {{
    font-size: 12px;
    color: #666;
  }}
  .header .meta {{
    font-size: 9px;
    color: #999;
    margin-top: 4px;
  }}
  .summary-grid {{
    display: flex;
    gap: 12px;
    margin-bottom: 24px;
  }}
  .summary-card {{
    flex: 1;
    padding: 14px;
    border-radius: 6px;
    text-align: center;
  }}
  .summary-card .number {{
    font-size: 28px;
    font-weight: 700;
    display: block;
  }}
  .summary-card .label {{
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-top: 2px;
  }}
  .card-total {{ background: #f0f0f0; }}
  .card-total .number {{ color: #232f3e; }}
  .card-compliant {{ background: #e8f5e9; }}
  .card-compliant .number {{ color: #2e7d32; }}
  .card-suppressed {{ background: #fff3e0; }}
  .card-suppressed .number {{ color: #e65100; }}
  .card-noncompliant {{ background: #ffebee; }}
  .card-noncompliant .number {{ color: #c62828; }}
  h2 {{
    font-size: 14px;
    color: #232f3e;
    border-bottom: 1px solid #ddd;
    padding-bottom: 6px;
    margin-top: 28px;
    margin-bottom: 12px;
  }}
  h3 {{
    font-size: 12px;
    color: #444;
    margin: 16px 0 8px 0;
  }}
  table {{
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 16px;
    font-size: 9px;
  }}
  th {{
    background: #232f3e;
    color: white;
    padding: 6px 8px;
    text-align: left;
    font-weight: 600;
    font-size: 9px;
  }}
  td {{
    padding: 5px 8px;
    border-bottom: 1px solid #e0e0e0;
    vertical-align: top;
    word-break: break-word;
  }}
  tr:nth-child(even) {{ background: #fafafa; }}
  .badge {{
    display: inline-block;
    padding: 1px 6px;
    border-radius: 3px;
    font-size: 8px;
    font-weight: 600;
  }}
  .badge-error {{ background: #ffcdd2; color: #b71c1c; }}
  .badge-warning {{ background: #fff9c4; color: #f57f17; }}
  .stack-summary-table td:first-child {{ font-weight: 600; }}
  .pass-rate {{
    font-size: 11px;
    color: #2e7d32;
    font-weight: 600;
    margin-top: 4px;
  }}
  .footer {{
    margin-top: 30px;
    padding-top: 10px;
    border-top: 1px solid #ddd;
    font-size: 8px;
    color: #999;
    text-align: center;
  }}
</style>
</head>
<body>

<div class="header">
  <h1>CDK Nag Report</h1>
  <div class="subtitle">AWS Solutions Checks — Security Agent Demo</div>
  <div class="meta">Generated: {timestamp} &nbsp;|&nbsp; Rule Pack: AwsSolutions &nbsp;|&nbsp; Stage: dev</div>
</div>

<div class="summary-grid">
  <div class="summary-card card-total">
    <span class="number">{total_checks}</span>
    <div class="label">Total Checks</div>
  </div>
  <div class="summary-card card-compliant">
    <span class="number">{totals['Compliant']}</span>
    <div class="label">Compliant</div>
  </div>
  <div class="summary-card card-suppressed">
    <span class="number">{totals['Suppressed']}</span>
    <div class="label">Suppressed</div>
  </div>
  <div class="summary-card card-noncompliant">
    <span class="number">{totals['Non-Compliant']}</span>
    <div class="label">Non-Compliant</div>
  </div>
</div>
"""

    if total_checks > 0:
        pass_rate = ((totals["Compliant"] + totals["Suppressed"]) / total_checks) * 100
        html += f'<div class="pass-rate">Pass Rate (Compliant + Suppressed): {pass_rate:.1f}%</div>\n'

    # Per-stack breakdown
    html += "<h2>Per-Stack Breakdown</h2>\n"
    html += '<table class="stack-summary-table"><tr><th>Stack</th><th>Total</th><th>Compliant</th><th>Suppressed</th><th>Non-Compliant</th></tr>\n'
    for stack_name, rows in all_data.items():
        c = sum(1 for r in rows if r["Compliance"] == "Compliant")
        s = sum(1 for r in rows if r["Compliance"] == "Suppressed")
        nc = sum(1 for r in rows if r["Compliance"] == "Non-Compliant")
        html += f"<tr><td>{stack_name}</td><td>{len(rows)}</td><td>{c}</td><td>{s}</td><td>{nc}</td></tr>\n"
    html += "</table>\n"

    # Non-compliant findings
    html += f"<h2>Non-Compliant Findings ({len(unique_nc)} unique)</h2>\n"
    if unique_nc:
        html += "<table><tr><th>Rule ID</th><th>Stack</th><th>Resource</th><th>Level</th><th>Description</th></tr>\n"
        for e in unique_nc:
            level_class = "badge-error" if e["level"] == "Error" else "badge-warning"
            html += f'<tr><td><strong>{e["rule"]}</strong></td><td>{e["stack"]}</td><td>{e["resource"]}</td><td><span class="badge {level_class}">{e["level"]}</span></td><td>{e["info"]}</td></tr>\n'
        html += "</table>\n"
    else:
        html += "<p>No non-compliant findings. All checks either pass or have documented suppressions.</p>\n"

    # Suppressed findings
    html += f"<h2>Suppressed Findings ({len(unique_sup)} unique)</h2>\n"
    if unique_sup:
        html += "<table><tr><th>Rule ID</th><th>Stack</th><th>Resource</th><th>Level</th><th>Suppression Reason</th></tr>\n"
        for e in unique_sup:
            level_class = "badge-error" if e["level"] == "Error" else "badge-warning"
            html += f'<tr><td><strong>{e["rule"]}</strong></td><td>{e["stack"]}</td><td>{e["resource"]}</td><td><span class="badge {level_class}">{e["level"]}</span></td><td>{e["reason"]}</td></tr>\n'
        html += "</table>\n"
    else:
        html += "<p>No suppressed findings.</p>\n"

    html += """
<div class="footer">
  CDK Nag Report — AWS Solutions Checks | Security Agent Demo | Confidential
</div>
</body>
</html>"""

    return html


def main():
    html = generate_html()

    # Write HTML intermediate
    html_path = OUTPUT_PATH.replace(".pdf", ".html")
    with open(html_path, "w") as f:
        f.write(html)
    print(f"HTML report written to: {html_path}")

    # Try to convert to PDF using weasyprint or wkhtmltopdf
    try:
        from weasyprint import HTML
        HTML(string=html).write_pdf(OUTPUT_PATH)
        print(f"PDF report written to: {OUTPUT_PATH}")
        return
    except ImportError:
        pass

    # Fallback: try wkhtmltopdf
    import subprocess
    try:
        subprocess.run(
            ["wkhtmltopdf", "--quiet", "--page-size", "Letter", "--margin-top", "15mm",
             "--margin-bottom", "15mm", "--margin-left", "15mm", "--margin-right", "15mm",
             html_path, OUTPUT_PATH],
            check=True, capture_output=True
        )
        print(f"PDF report written to: {OUTPUT_PATH}")
        return
    except (FileNotFoundError, subprocess.CalledProcessError):
        pass

    # Fallback: try Chrome/Chromium headless
    for chrome in ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
                   "google-chrome", "chromium-browser", "chromium"]:
        try:
            subprocess.run(
                [chrome, "--headless", "--disable-gpu", "--no-sandbox",
                 f"--print-to-pdf={OUTPUT_PATH}", html_path],
                check=True, capture_output=True
            )
            print(f"PDF report written to: {OUTPUT_PATH}")
            return
        except (FileNotFoundError, subprocess.CalledProcessError):
            continue

    print(f"Could not generate PDF. HTML report available at: {html_path}")
    print("Install weasyprint (pip install weasyprint) or wkhtmltopdf for PDF generation.")


if __name__ == "__main__":
    main()
