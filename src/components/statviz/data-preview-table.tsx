'use client';

import React from 'react';
import type { DataRow, ColumnDefinition } from '@/types';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableCaption,
} from '@/components/ui/table';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

interface DataPreviewTableProps {
  data: DataRow[];
  columns: ColumnDefinition[];
  fileName?: string;
}

export function DataPreviewTable({ data, columns, fileName }: DataPreviewTableProps) {
  if (!data || data.length === 0 || !columns || columns.length === 0) {
    return <p className="text-muted-foreground">No data to display or data is empty.</p>;
  }

  const previewData = data.slice(0, 10); // Show first 10 rows

  return (
    <ScrollArea className="w-full whitespace-nowrap rounded-md border">
      <Table>
        {fileName && <TableCaption>Preview of {fileName} (first 10 rows)</TableCaption>}
        {!fileName && <TableCaption>Data Preview (first 10 rows)</TableCaption>}
        <TableHeader>
          <TableRow>
            {columns.map((col) => (
              <TableHead key={col.id} className="font-semibold">{col.name}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {previewData.map((row, rowIndex) => (
            <TableRow key={`row-${rowIndex}`}>
              {columns.map((col) => (
                <TableCell key={`cell-${rowIndex}-${col.id}`}>
                  {String(row[col.id] === null || row[col.id] === undefined ? '' : row[col.id])}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}
