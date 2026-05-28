import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MessageCircle } from "lucide-react";

interface UserData {
  id: string;
  email: string;
  full_name: string | null;
  crm: string | null;
  specialty: string | null;
  whatsapp: string | null;
  phone: string | null;
  subscription_plan: string | null;
  subscription_status: string | null;
  laudos_count: number;
  created_at: string;
}

interface AdminUserTableProps {
  users: UserData[];
}

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Ativo",
  TRIALING: "Trial",
  CANCELED: "Cancelado",
  EXPIRED: "Expirado",
  PAST_DUE: "Atrasado",
  INACTIVE: "Inativo",
};

const formatPhone = (raw: string) => {
  const d = raw.replace(/\D/g, "");
  if (d.length === 11) return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`;
  if (d.length === 13) return `+${d.slice(0,2)} (${d.slice(2,4)}) ${d.slice(4,9)}-${d.slice(9)}`;
  return raw;
};

const waLink = (raw: string) => {
  const d = raw.replace(/\D/g, "");
  const withCountry = d.startsWith("55") ? d : `55${d}`;
  return `https://wa.me/${withCountry}`;
};

export const AdminUserTable = ({ users }: AdminUserTableProps) => {
  return (
    <Card className="shadow-soft">
      <CardHeader>
        <CardTitle className="text-lg">Usuários ({users.length})</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>WhatsApp</TableHead>
              <TableHead>CRM</TableHead>
              <TableHead>Especialidade</TableHead>
              <TableHead>Plano</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Laudos</TableHead>
              <TableHead>Cadastro</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => {
              const contact = user.whatsapp || user.phone;
              return (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.full_name || "-"}</TableCell>
                  <TableCell className="text-sm">{user.email}</TableCell>
                  <TableCell>
                    {contact ? (
                      <a
                        href={waLink(contact)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-sm text-green-600 hover:text-green-700 hover:underline"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        {formatPhone(contact)}
                      </a>
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>{user.crm || "-"}</TableCell>
                  <TableCell className="text-sm">{user.specialty || "-"}</TableCell>
                  <TableCell>
                    {user.subscription_plan ? (
                      <Badge variant={user.subscription_plan === "PRO" ? "default" : "secondary"}>
                        {user.subscription_plan}
                      </Badge>
                    ) : "-"}
                  </TableCell>
                  <TableCell>
                    {user.subscription_status ? (
                      <Badge
                        variant={
                          user.subscription_status === "ACTIVE"
                            ? "default"
                            : user.subscription_status === "TRIALING"
                            ? "secondary"
                            : "destructive"
                        }
                      >
                        {STATUS_LABELS[user.subscription_status] || user.subscription_status}
                      </Badge>
                    ) : "-"}
                  </TableCell>
                  <TableCell>{user.laudos_count}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(user.created_at).toLocaleDateString("pt-BR")}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};
