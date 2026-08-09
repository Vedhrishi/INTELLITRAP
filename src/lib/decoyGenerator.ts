/**
 * Automatic decoy generation — the honeypot never depends on database rows,
 * so it can never fail with an empty template table.
 */

export type GeneratedDecoy = {
  id: string;
  file_name: string;
  content: string;
  mime_type: string;
  category: string;
  fake_size: number;
};

const CATEGORIES = [
  "credentials",
  "employee_records",
  "financial_data",
  "customer_database",
  "strategic_plans",
  "source_code",
  "medical_records",
  "company_confidential",
] as const;

const FILE_NAMES: Record<string, string[]> = {
  credentials: [
    "System_Credentials_Backup.txt",
    "Admin_Passwords_2025.txt",
    "Service_Account_Keys.txt",
    "API_Keys_Production.txt",
  ],
  employee_records: [
    "Employee_Master_List.csv",
    "HR_Database_Export.csv",
    "Staff_Details_2025.csv",
    "Payroll_Register_Q4.csv",
  ],
  financial_data: [
    "Q4_Financial_Summary.txt",
    "Annual_Revenue_Report.xlsx",
    "Bank_Account_Details.txt",
    "Financial_Projections_2025.txt",
  ],
  customer_database: [
    "Customer_Export_Full.json",
    "Client_Database_2025.csv",
    "User_PII_Backup.json",
    "CRM_Export_December.csv",
  ],
  strategic_plans: [
    "Board_Strategy_2025.txt",
    "Acquisition_Plans_Confidential.txt",
    "Market_Expansion_Roadmap.txt",
    "IPO_Strategy_Internal.txt",
  ],
  source_code: [
    "Application_Source_Export.zip",
    "Core_Engine_v3.2_Private.txt",
    "Backend_Services_Backup.txt",
    "Database_Schema_Production.sql",
  ],
  medical_records: [
    "Health_Records_HR.csv",
    "Employee_Medical_Database.csv",
    "Insurance_Claims_2025.csv",
    "Clinical_Data_Backup.txt",
  ],
  company_confidential: [
    "Vendor_Contracts_Summary.txt",
    "Legal_Agreements_Archive.txt",
    "Merger_Discussion_Notes.txt",
    "Board_Meeting_Minutes.txt",
  ],
};

const MIME_TYPES: Record<string, string> = {
  credentials: "text/plain",
  employee_records: "text/csv",
  financial_data: "text/plain",
  customer_database: "application/json",
  strategic_plans: "text/plain",
  source_code: "text/plain",
  medical_records: "text/csv",
  company_confidential: "text/plain",
};

function contentTemplates(): Record<string, string> {
  const today = new Date().toISOString().split("T")[0];
  return {
    credentials: `=== PRODUCTION CREDENTIALS — STRICTLY CONFIDENTIAL ===
Database Host: db-prod-01.internal.company.com
Primary Username: svc_admin_prod
Password: [ROTATED — Contact IT Security Dept]
API Gateway: https://api.internal/v3
API Key: sk_live_[REVOKED AS OF LAST AUDIT]
AWS Access: AKIA[REDACTED BY SECURITY POLICY]
Admin Console: https://admin.internal (IP-restricted)

Secondary DB: db-replica-01.internal.company.com
Backup Username: svc_backup
Backup Password: [ROTATED]

NOTICE: Access to this file is logged.
Unauthorized access will be prosecuted.
Contact: security@company.internal`,

    employee_records: `ID,Full Name,Department,Designation,Email,Phone,Salary,Start Date,Manager
E1001,[REDACTED],Engineering,Principal Engineer,e1001@internal,+91-XXXXXXXX01,[REDACTED],2019-03-15,Engineering Head
E1002,[REDACTED],Human Resources,HR Director,e1002@internal,+91-XXXXXXXX02,[REDACTED],2018-07-01,VP Operations
E1003,[REDACTED],Finance,CFO,e1003@internal,+91-XXXXXXXX03,[REDACTED],2017-01-10,CEO
E1004,[REDACTED],Engineering,Senior Engineer,e1004@internal,+91-XXXXXXXX04,[REDACTED],2021-06-20,Engineering Head
E1005,[REDACTED],Security,CISO,e1005@internal,+91-XXXXXXXX05,[REDACTED],2020-09-01,CEO

CONFIDENTIAL — HR AND AUTHORISED MANAGEMENT ONLY
Unauthorised distribution is a termination offence.`,

    financial_data: `INTERNAL FINANCIAL SUMMARY — BOARD RESTRICTED
Fiscal Year: 2025

Revenue by Quarter:
Q1 2025: ₹2,45,00,000
Q2 2025: ₹3,12,00,000
Q3 2025: ₹2,98,00,000
Q4 2025 (projected): ₹4,23,00,000

Annual Net Revenue: ₹12,78,00,000
Operating Margin: 27.3%
EBITDA: ₹3,45,00,000

Primary Banking: [REDACTED PER POLICY]
Audit Firm: [REDACTED]

DISTRIBUTION: Finance Committee and Board Only
Any external disclosure is a securities violation.`,

    customer_database: `{
  "export_date": "${today}",
  "record_count": 15420,
  "classification": "PII — RESTRICTED",
  "records": [
    {"id":"C001","tier":"Enterprise","region":"South India","status":"Active"},
    {"id":"C002","tier":"Professional","region":"West India","status":"Active"},
    {"id":"C003","tier":"Standard","region":"North India","status":"Active"}
  ],
  "notice": "Contains personal identifiable information subject to IT Act 2000 and DPDP Act 2023. Unauthorized access or export is a criminal offence."
}`,

    strategic_plans: `BOARD OF DIRECTORS — STRICTLY CONFIDENTIAL
Subject: Strategic Roadmap FY2025-2026

1. GEOGRAPHIC EXPANSION
   Target: Southeast Asia (Q1-Q2 2025)
   Investment: [REDACTED]

2. M&A PIPELINE
   Target A: Under evaluation (NDA signed)
   Target B: Due diligence phase
   Combined value: [REDACTED]

3. FUNDING
   Series B: Preparation underway
   Target valuation: [REDACTED]
   Lead investor discussions: Active

4. PRODUCT
   AI Integration: Phase 3 launch Q2
   Enterprise tier: Q3 launch

UNAUTHORIZED DISCLOSURE SUBJECT TO LEGAL ACTION.
Attorney-client privileged communication.`,

    source_code: `=== SOURCE CODE EXPORT — HIGHLY CONFIDENTIAL ===
Repository: core-platform-monorepo
Export Date: ${today}
Branch: main (HEAD)
Commit: [HASH REDACTED]
Total Files: 2,847
Total Size: 45.2 MB

Included:
  /src/services/payment-processor/
  /src/services/auth-engine/
  /src/infrastructure/
  /config/production/
  /migrations/

NOTICE: All deployment keys have been rotated.
This export is for backup purposes only.
Do not distribute. IP protected.`,

    medical_records: `Employee ID,Name,Blood Group,Condition,Insurance Provider,Policy Number,Last Checkup
E1001,[REDACTED],B+,Hypertension,[PROVIDER REDACTED],POL-XXXX-001,2025-06-15
E1002,[REDACTED],A+,Type 2 Diabetes,[PROVIDER REDACTED],POL-XXXX-002,2025-07-01
E1003,[REDACTED],O+,None,[PROVIDER REDACTED],POL-XXXX-003,2025-05-20
E1004,[REDACTED],AB+,Asthma,[PROVIDER REDACTED],POL-XXXX-004,2025-08-01

STRICTLY CONFIDENTIAL
Access: HR Director and Medical Officer only.
Governed by health privacy regulations.`,

    company_confidential: `VENDOR AGREEMENTS SUMMARY — RESTRICTED
Prepared by: Legal Department
Classification: Confidential

Active Contracts: 14
Total Annual Value: [REDACTED PER POLICY]

Key Vendors:
1. Cloud Infrastructure: [REDACTED] — ₹[REDACTED]/yr
2. Security Services: [REDACTED] — ₹[REDACTED]/yr
3. HR Platform: [REDACTED] — ₹[REDACTED]/yr
4. Analytics: [REDACTED] — ₹[REDACTED]/yr

Renewal Schedule: See attached calendar
All contracts under NDA — terms confidential.
LEGAL PRIVILEGE APPLIES TO THIS DOCUMENT.`,
  };
}

function randomFrom<T>(values: readonly T[]): T {
  return values[Math.floor(Math.random() * values.length)] as T;
}

export function generateDecoyFile(category?: string): GeneratedDecoy {
  const templates = contentTemplates();
  const cat = category && FILE_NAMES[category] ? category : randomFrom(CATEGORIES);
  const names = FILE_NAMES[cat] ?? FILE_NAMES["credentials"]!;
  const fileName = randomFrom(names);
  const content = templates[cat] ?? templates["credentials"]!;

  return {
    id: `decoy-${cat}-${Math.random().toString(36).slice(2, 10)}`,
    file_name: fileName,
    content,
    mime_type: MIME_TYPES[cat] ?? "text/plain",
    category: cat,
    fake_size: Math.floor(200_000 + Math.random() * 3_800_000),
  };
}

/** A set of decoys, each from a different category. */
export function generateDecoySet(count = 3): GeneratedDecoy[] {
  const used = new Set<string>();
  const result: GeneratedDecoy[] = [];
  let attempts = 0;

  while (result.length < count && attempts < 20) {
    const cat = randomFrom(CATEGORIES);
    if (!used.has(cat)) {
      used.add(cat);
      result.push(generateDecoyFile(cat));
    }
    attempts += 1;
  }
  return result;
}
