import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface UserData {
  id: string;
  email: string;
  full_name: string | null;
  crm: string | null;
  specialty: string | null;
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
              <TableHead>CRM</TableHead>
              <TableHead>Especialidade</TableHead>
              <TableHead>Plano</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Laudos</TableHead>
              <TableHead>Cadastro</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="font-medium">{user.full_name || "-"}</TableCell>
                <TableCell className="text-sm">{user.email}</TableCell>
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
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};
