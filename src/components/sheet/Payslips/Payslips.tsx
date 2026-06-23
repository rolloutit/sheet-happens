import { Download, Eye, FileText, Upload } from "lucide-react";

import { Avatar } from "@/src/components/ui/Avatar";
import { Badge } from "@/src/components/ui/Badge";
import { Button } from "@/src/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/Card";
import { DataTable } from "@/src/components/ui/Table";
import { Dropzone } from "@/src/components/ui/Dropzone";
import { IconButton } from "@/src/components/ui/IconButton";
import { Skeleton } from "@/src/components/ui/Skeleton";
import { cn } from "@/src/lib/utils";
import type { PayslipsProps } from "./Payslips.types";

const rows = [
  {
    id: "1",
    person: "Lena Kovacs",
    month: "June 2026",
    status: "Available",
    file: "payslip-june.pdf",
  },
  { id: "2", person: "Mark Chen", month: "June 2026", status: "Missing", file: "" },
];

export function Payslips({ role = "employee", className }: PayslipsProps) {
  return (
    <div className={cn("grid gap-4", className)}>
      {role === "employee" ? <MyPayslips /> : <PayslipAdmin />}
      <PayslipViewerPreview />
    </div>
  );
}

function MyPayslips() {
  return (
    <>
      <Card variant="featured">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <Badge tone="success">Latest available</Badge>
            <h2 className="mt-3 text-2xl font-semibold">June 2026 payslip</h2>
            <p className="mt-1 text-sm text-muted-foreground">Published by payroll today.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="soft" icon={Eye}>
              Preview
            </Button>
            <Button variant="cta" icon={Download}>
              Download
            </Button>
          </div>
        </div>
      </Card>
      <Card variant="elevated">
        <CardHeader>
          <CardTitle>History</CardTitle>
        </CardHeader>
        <CardContent>
          {rows.slice(0, 1).map((row) => (
            <div
              key={row.id}
              className="flex items-center gap-3 rounded-[var(--radius-lg)] bg-secondary p-3"
            >
              <FileText className="size-5 text-accent" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="font-ui text-sm font-semibold">{row.month}</p>
                <p className="text-sm text-muted-foreground">{row.file}</p>
              </div>
              <IconButton icon={Download} label="Download payslip" size="sm" />
            </div>
          ))}
        </CardContent>
      </Card>
    </>
  );
}

function PayslipAdmin() {
  return (
    <>
      <Card variant="elevated">
        <CardHeader>
          <CardTitle>Upload sheet</CardTitle>
          <Button variant="cta" icon={Upload}>
            Upload
          </Button>
        </CardHeader>
        <CardContent>
          <Dropzone
            label="Upload payslip PDF"
            description="Select employee and month before upload."
            files={[{ id: "1", name: "lena-june.pdf", sizeLabel: "188 KB", status: "done" }]}
          />
        </CardContent>
      </Card>
      <DataTable
        rows={rows}
        getRowKey={(row) => row.id}
        columns={[
          {
            id: "person",
            header: "Employee",
            cell: (row) => (
              <div className="flex items-center gap-3">
                <Avatar name={row.person} size="sm" />
                <span>{row.person}</span>
              </div>
            ),
          },
          { id: "month", header: "Month", accessor: "month" },
          {
            id: "status",
            header: "Status",
            cell: (row) => (
              <Badge tone={row.status === "Available" ? "success" : "warning"}>{row.status}</Badge>
            ),
          },
        ]}
      />
    </>
  );
}

function PayslipViewerPreview() {
  return (
    <Card variant="elevated">
      <CardHeader>
        <CardTitle>Viewer</CardTitle>
        <Badge tone="info">Signed link loading</Badge>
      </CardHeader>
      <CardContent>
        <Skeleton variant="document" />
      </CardContent>
    </Card>
  );
}
