export function formatDevsincId(devsincId: string | null | undefined): string {
  return devsincId || "—";
}

export function engineerOptionLabel(name: string, devsincId: string | null | undefined): string {
  const id = devsincId ? `Devsinc ID - ${devsincId}` : "No Devsinc ID";
  return `${name} (${id})`;
}
