// Placeholder for excel parsing.
// Full XLSX parsing requires a library like 'xlsx'.
// This mock version will simulate some behavior.
import type { DataRow, ColumnDefinition, SheetData } from '@/types';

export async function getSheetNamesFromXLSX(file: File): Promise<string[]> {
  // Mock implementation
  console.warn("getSheetNamesFromXLSX is a mock. Full XLSX support requires a library.");
  if (file.name.endsWith('.xlsx')) {
    return ['Sheet1', 'Sheet2_Example', 'MyDataSheet'];
  }
  return [];
}

export async function parseXLSXSheet(
  file: File,
  sheetName: string
): Promise<{ data: DataRow[], columns: ColumnDefinition[] }> {
  // Mock implementation
  console.warn(`parseXLSXSheet for ${sheetName} is a mock. Full XLSX support requires a library.`);
  
  // Simulate some data based on sheet name for consistent mocking
  let headers: string[];
  let sampleData: DataRow[];

  if (sheetName === 'Sheet1') {
    headers = ['ID', 'Group', 'Value1', 'Response'];
    sampleData = [
      { ID: 1, Group: 'A', Value1: 10.5, Response: 25 },
      { ID: 2, Group: 'B', Value1: 12.3, Response: 30 },
      { ID: 3, Group: 'A', Value1: 9.8, Response: 22 },
    ];
  } else if (sheetName === 'Sheet2_Example') {
    headers = ['Treatment', 'Subject', 'Measurement'];
    sampleData = [
      { Treatment: 'X', Subject: 'S1', Measurement: 100 },
      { Treatment: 'Y', Subject: 'S2', Measurement: 150 },
    ];
  } else {
    headers = ['ColA', 'ColB', 'ColC'];
    sampleData = [
      { ColA: 'data1', ColB: 1, ColC: true },
      { ColA: 'data2', ColB: 2, ColC: false },
    ];
  }

  const columns: ColumnDefinition[] = headers.map(header => ({
    id: header,
    name: header,
  }));

  // Simulate returning up to 10 rows for preview
  const data = sampleData.slice(0, 10);
  
  return { data, columns };
}
