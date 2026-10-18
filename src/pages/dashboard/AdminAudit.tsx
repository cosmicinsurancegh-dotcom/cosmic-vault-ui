import {
  Callout,
  LoadingState,
  Pagination,
  PageHeader,
  Panel,
  TableShell,
  Td,
  Th,
} from "@/components/dashboard/PlatformUI";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { api } from "@/convex/_generated/api";
import { formatDateTime } from "@/lib/format";
import { STAFF_PERMISSIONS, can } from "@/lib/permissions";
import { useQuery } from "convex/react";
import { ShieldCheck } from "lucide-react";
import { useState } from "react";

const ENTITY_TYPES = [
  "all",
  "users",
  "customers",
  "products",
  "applications",
  "policies",
  "policyRequests",
  "claims",
  "transactions",
  "settings",
  "brokerAssignments",
  "brokerProfiles",
];

export default function AdminAuditPage() {
  const { user } = useAuth();
  const allowed = can(user?.role, user?.permissions, STAFF_PERMISSIONS.AUDIT_VIEW);
  const [action, setAction] = useState("");
  const [entityType, setEntityType] = useState("all");
  const [page, setPage] = useState(1);
  const log = useQuery(
    api.audit.list,
    allowed
      ? { action: action || undefined, entityType, page, pageSize: 20 }
      : "skip",
  );

  if (!allowed) {
    return (
      <div className="space-y-6">
        <PageHeader eyebrow="Audit" title="Restricted audit log." />
        <Callout tone="warning" title="Permission required">
          Audit access must be granted explicitly by a super admin.
        </Callout>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Audit & security"
        title="Every sensitive action, recorded."
        description="Audit records are append-only. They capture the actor, role, entity, before/after values, reason, and timestamp."
      />

      <Panel>
        <div className="flex flex-wrap gap-2 border-b border-line px-5 py-3">
          <div className="relative min-w-[220px] flex-1">
            <ShieldCheck className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={action}
              onChange={(event) => {
                setAction(event.target.value);
                setPage(1);
              }}
              placeholder="Filter by action (for example policy.issued)"
              className="h-9 rounded-[4px] bg-card pl-9 text-xs"
            />
          </div>
          <select
            aria-label="Entity type"
            value={entityType}
            onChange={(event) => {
              setEntityType(event.target.value);
              setPage(1);
            }}
            className="h-9 rounded-[4px] border border-line bg-card px-3 text-xs text-ink"
          >
            {ENTITY_TYPES.map((value) => (
              <option key={value} value={value}>
                {value === "all" ? "All entities" : value}
              </option>
            ))}
          </select>
        </div>

        {log === undefined ? (
          <LoadingState label="Loading audit trail" />
        ) : log.rows.length === 0 ? (
          <p className="px-6 py-10 text-center text-xs text-muted-foreground">
            No audit entries match these filters.
          </p>
        ) : (
          <>
            <TableShell>
              <thead>
                <tr>
                  <Th>When</Th>
                  <Th>Actor</Th>
                  <Th>Action</Th>
                  <Th>Entity</Th>
                  <Th>Reason</Th>
                  <Th>Details</Th>
                </tr>
              </thead>
              <tbody>
                {log.rows.map((entry) => (
                  <tr key={entry._id} className="align-top transition-colors hover:bg-primary/[0.02]">
                    <Td className="whitespace-nowrap">{formatDateTime(entry.at)}</Td>
                    <Td>
                      <p className="text-xs text-ink">{entry.actorName}</p>
                      <p className="text-[0.6rem] capitalize text-muted-foreground">
                        {entry.actorRole.replace("_", " ")}
                      </p>
                    </Td>
                    <Td className="font-medium">{entry.action}</Td>
                    <Td>
                      <p className="text-[0.68rem]">{entry.entityType}</p>
                      <p className="max-w-[140px] truncate text-[0.58rem] text-muted-foreground">
                        {entry.entityId}
                      </p>
                    </Td>
                    <Td className="max-w-[180px] text-[0.65rem]">{entry.reason ?? "-"}</Td>
                    <Td>
                      <details>
                        <summary className="cursor-pointer text-[0.65rem] font-medium text-primary">
                          View
                        </summary>
                        <pre className="mt-2 max-h-[180px] max-w-[320px] overflow-auto rounded-lg bg-muted p-2 text-[0.58rem] leading-4 text-muted-foreground">
                          {JSON.stringify({ before: entry.before, after: entry.after }, null, 2)}
                        </pre>
                      </details>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </TableShell>
            <div className="flex items-center justify-between">
              <Pagination page={log.page} pageSize={log.pageSize} total={log.total} onPage={setPage} />
              <span className="px-5 text-[0.62rem] text-muted-foreground">Read-only</span>
            </div>
          </>
        )}
      </Panel>

      <Panel className="p-5">
        <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Retention & protection</h2>
        <p className="mt-2 max-w-3xl text-xs leading-5 text-muted-foreground">
          Ordinary administrators cannot edit or delete audit records; the platform exposes no mutation
          for doing so. Sensitive fields are shown only to holders of audit access. Export of audit data
          is not provided, to reduce the risk of silent exfiltration.
        </p>
      </Panel>
    </div>
  );
}
