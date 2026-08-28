type StudentRelationRow = {
  student_id: string;
};

export function groupStudentRelations<T extends StudentRelationRow>(rows: readonly T[]) {
  const grouped = new Map<string, T[]>();

  for (const row of rows) {
    const studentRows = grouped.get(row.student_id);
    if (studentRows) {
      studentRows.push(row);
    } else {
      grouped.set(row.student_id, [row]);
    }
  }

  return grouped;
}
