import { useState } from "react";
import { Pencil, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { departmentLabels, type DepartmentId } from "@shared/schedule";
import { EmptyState } from "@/components/staff/Shared";

type Department = DepartmentId;

export function EmployeeManager() {
  const utils = trpc.useUtils();
  const [department, setDepartment] = useState<Department>("waiters");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editOrder, setEditOrder] = useState(0);
  const directory = trpc.admin.directory.useQuery({ department });
  const refresh = async () => {
    await Promise.all([
      utils.admin.directory.invalidate(),
      utils.staff.roster.invalidate(),
    ]);
  };
  const create = trpc.admin.createEmployee.useMutation({
    onSuccess: async () => {
      toast.success("თანამშრომელი დაემატა.");
      setName("");
      setPhone("");
      await refresh();
    },
    onError: error => toast.error(error.message),
  });
  const update = trpc.admin.updateEmployee.useMutation({
    onSuccess: async () => {
      toast.success("თანამშრომელი განახლდა.");
      setEditing(null);
      await refresh();
    },
    onError: error => toast.error(error.message),
  });
  const setActive = trpc.admin.setEmployeeActive.useMutation({
    onSuccess: async (_result, variables) => {
      toast.success(variables.active ? "თანამშრომელი ჩაირთო." : "თანამშრომელი გამოირთო.");
      await refresh();
    },
    onError: error => toast.error(error.message),
  });
  const remove = trpc.admin.deleteEmployee.useMutation({
    onSuccess: async () => {
      toast.success("თანამშრომელი სიიდან წაიშალა.");
      setEditing(null);
      await refresh();
    },
    onError: error => toast.error(error.message),
  });
  const startEdit = (person: {
    id: string;
    name: string;
    phone: string;
    positionOrder: number;
  }) => {
    setEditing(person.id);
    setEditName(person.name);
    setEditPhone(person.phone);
    setEditOrder(person.positionOrder);
  };
  return (
    <section className="manager-panel">
      <div className="section-title">
        <h2>თანამშრომლების მართვა</h2>
        <span>{directory.data?.length ?? 0} ჩანაწერი</span>
      </div>
      <form
        className="manager-form employee-create"
        onSubmit={event => {
          event.preventDefault();
          create.mutate({ department, name, phone });
        }}
      >
        <label>
          დეპარტამენტი
          <select
            value={department}
            onChange={event => {
              setDepartment(event.target.value as Department);
              setEditing(null);
            }}
          >
            {Object.entries(departmentLabels).map(([id, label]) => (
              <option value={id} key={id}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          სახელი და გვარი
          <input
            required
            maxLength={120}
            value={name}
            onChange={event => setName(event.target.value)}
            placeholder="ახალი თანამშრომელი"
          />
        </label>
        <label>
          ტელეფონი
          <input
            maxLength={40}
            value={phone}
            onChange={event => setPhone(event.target.value)}
            placeholder="არასავალდებულო"
          />
        </label>
        <button className="primary-button" type="submit" disabled={create.isPending}>
          <UserPlus size={16} />
          {create.isPending ? "ემატება…" : "დამატება"}
        </button>
      </form>
      <p className="muted employee-note">
        გამორთული თანამშრომელი აღარ ჩანს განრიგსა და გუნდში. უკვე ჩაწერილი ცვლები
        კალენდარზე რჩება. სახელის შეცვლა ამ დეპარტამენტის ცვლებსაც გადაიტანს.
      </p>
      {directory.isLoading ? (
        <div className="loading-card" />
      ) : directory.isError ? (
        <div className="error-banner">
          სია ვერ ჩაიტვირთა.{" "}
          <button type="button" onClick={() => directory.refetch()}>
            ხელახლა ცდა
          </button>
        </div>
      ) : directory.data?.length ? (
        <div className="admin-account-list">
          {directory.data.map(person => (
            <div key={person.id} className={person.active ? "" : "employee-off"}>
              {editing === person.id ? (
                <form
                  className="employee-edit"
                  onSubmit={event => {
                    event.preventDefault();
                    update.mutate({
                      department,
                      staffId: person.id,
                      name: editName,
                      phone: editPhone,
                      positionOrder: editOrder,
                    });
                  }}
                >
                  <input
                    required
                    maxLength={120}
                    value={editName}
                    onChange={event => setEditName(event.target.value)}
                    aria-label="სახელი"
                  />
                  <input
                    maxLength={40}
                    value={editPhone}
                    onChange={event => setEditPhone(event.target.value)}
                    aria-label="ტელეფონი"
                    placeholder="ტელეფონი"
                  />
                  <input
                    type="number"
                    min={0}
                    max={9999}
                    value={editOrder}
                    onChange={event => setEditOrder(Number(event.target.value))}
                    aria-label="რიგი"
                  />
                  <button className="primary-button" type="submit" disabled={update.isPending}>
                    შენახვა
                  </button>
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => setEditing(null)}
                  >
                    გაუქმება
                  </button>
                </form>
              ) : (
                <>
                  <span>
                    <b>{person.name}</b>
                    <small>
                      {person.role}
                      {person.phone ? ` · ${person.phone}` : ""}
                    </small>
                  </span>
                  <span className="muted">რიგი {person.positionOrder}</span>
                  <span className="employee-actions">
                    <button
                      type="button"
                      className={
                        person.active
                          ? "secondary-button employee-toggle on"
                          : "secondary-button employee-toggle"
                      }
                      aria-pressed={person.active}
                      disabled={setActive.isPending}
                      onClick={() =>
                        setActive.mutate({
                          department,
                          staffId: person.id,
                          active: !person.active,
                        })
                      }
                    >
                      {person.active ? "გამორთვა" : "ჩართვა"}
                    </button>
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => startEdit(person)}
                    >
                      <Pencil size={14} /> რედაქტირება
                    </button>
                    <button
                      type="button"
                      className="secondary-button reject-button"
                      disabled={remove.isPending}
                      onClick={() => {
                        if (
                          window.confirm(
                            `${person.name} წაიშალოს სიიდან? ძველი ცვლები კალენდარზე დარჩება.`
                          )
                        )
                          remove.mutate({ department, staffId: person.id });
                      }}
                    >
                      <Trash2 size={14} /> წაშლა
                    </button>
                  </span>
                </>
              )}
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          title="თანამშრომლები არ არის"
          description="ამ დეპარტამენტში ჯერ არავინ არის ჩაწერილი."
        />
      )}
    </section>
  );
}
