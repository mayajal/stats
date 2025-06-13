'use client';

import React, { useState, useEffect } from 'react';
import type { ColumnDefinition, VariableMapping } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { GripVertical, PackagePlus, PackageMinus, Target, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface VariableDefinitionStepProps {
  columns: ColumnDefinition[];
  initialMapping?: Partial<VariableMapping>;
  onVariablesDefined: (mapping: VariableMapping) => void;
}

type DropZoneType = 'dependent' | 'independent' | 'values' | 'covariates';

export function VariableDefinitionStep({ columns, initialMapping, onVariablesDefined }: VariableDefinitionStepProps) {
  const [availableColumns, setAvailableColumns] = useState<ColumnDefinition[]>(columns);
  const [dependentVariable, setDependentVariable] = useState<ColumnDefinition | null>(initialMapping?.dependentVariable ? columns.find(c => c.id === initialMapping.dependentVariable) || null : null);
  const [independentVariables, setIndependentVariables] = useState<ColumnDefinition[]>(initialMapping?.independentVariables?.map(id => columns.find(c => c.id === id)).filter(Boolean) as ColumnDefinition[] || []);
  const [valuesColumn, setValuesColumn] = useState<ColumnDefinition | null>(initialMapping?.valuesColumn ? columns.find(c => c.id === initialMapping.valuesColumn) || null : null);
  const [covariates, setCovariates] = useState<ColumnDefinition[]>(initialMapping?.covariates?.map(id => columns.find(c => c.id === id)).filter(Boolean) as ColumnDefinition[] || []);

  const { toast } = useToast();

  useEffect(() => {
    const assignedIds = new Set<string>();
    if (dependentVariable) assignedIds.add(dependentVariable.id);
    independentVariables.forEach(col => assignedIds.add(col.id));
    if (valuesColumn) assignedIds.add(valuesColumn.id);
    covariates.forEach(col => assignedIds.add(col.id));
    
    setAvailableColumns(columns.filter(col => !assignedIds.has(col.id)));
  }, [columns, dependentVariable, independentVariables, valuesColumn, covariates]);
  
  useEffect(() => {
    onVariablesDefined({
      dependentVariable: dependentVariable?.id || null,
      independentVariables: independentVariables.map(col => col.id),
      valuesColumn: valuesColumn?.id || null,
      covariates: covariates.map(col => col.id),
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dependentVariable, independentVariables, valuesColumn, covariates]);


  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, column: ColumnDefinition, sourceType: DropZoneType | 'available') => {
    e.dataTransfer.setData('application/json', JSON.stringify({ column, sourceType }));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, targetZone: DropZoneType) => {
    e.preventDefault();
    const transferData = e.dataTransfer.getData('application/json');
    if (!transferData) return;

    const { column, sourceType }: { column: ColumnDefinition; sourceType: DropZoneType | 'available' } = JSON.parse(transferData);

    // Remove from source
    if (sourceType === 'dependent') setDependentVariable(null);
    else if (sourceType === 'independent') setIndependentVariables(prev => prev.filter(c => c.id !== column.id));
    else if (sourceType === 'values') setValuesColumn(null);
    else if (sourceType === 'covariates') setCovariates(prev => prev.filter(c => c.id !== column.id));
    // No need to remove from 'available' as it's derived

    // Add to target
    if (targetZone === 'dependent') {
      if (dependentVariable) { // If there's already a var, move it back to available
         // This logic is implicitly handled by useEffect updating availableColumns
      }
      setDependentVariable(column);
    } else if (targetZone === 'independent') {
      setIndependentVariables(prev => [...prev.filter(c => c.id !== column.id), column]);
    } else if (targetZone === 'values') {
       if (valuesColumn) {
         // This logic is implicitly handled by useEffect updating availableColumns
       }
      setValuesColumn(column);
    } else if (targetZone === 'covariates') {
      setCovariates(prev => [...prev.filter(c => c.id !== column.id), column]);
    }
    (e.currentTarget as HTMLDivElement).classList.remove('border-accent', 'bg-accent/10');
  };
  
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    (e.currentTarget as HTMLDivElement).classList.add('border-accent', 'bg-accent/10');
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    (e.currentTarget as HTMLDivElement).classList.remove('border-accent', 'bg-accent/10');
  };

  const DraggableColumn = ({ column, sourceType }: { column: ColumnDefinition; sourceType: DropZoneType | 'available' }) => (
    <div
      draggable
      onDragStart={(e) => handleDragStart(e, column, sourceType)}
      className="p-2 border rounded-md bg-card hover:shadow-md cursor-grab flex items-center text-sm"
      aria-label={`Draggable column ${column.name}`}
    >
      <GripVertical className="h-4 w-4 mr-2 text-muted-foreground" />
      {column.name}
    </div>
  );

  const DropZone = ({ title, children, zoneType, description, singleItemOnly = false }: { title: string; children: React.ReactNode; zoneType: DropZoneType; description: string; singleItemOnly?: boolean }) => (
    <Card 
      onDrop={(e) => handleDrop(e, zoneType)} 
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      className="min-h-[150px] transition-colors duration-150"
    >
      <CardHeader>
        <CardTitle className="font-headline text-md flex items-center">
          <Target className="h-5 w-5 mr-2 text-primary"/> {title}
          {singleItemOnly && (zoneType === 'dependent' ? dependentVariable : valuesColumn) && <CheckCircle className="h-5 w-5 ml-auto text-green-500" />}
          {!singleItemOnly && (zoneType === 'independent' ? independentVariables.length > 0 : covariates.length > 0 ) && <CheckCircle className="h-5 w-5 ml-auto text-green-500" />}
        </CardTitle>
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardHeader>
      <CardContent className="space-y-2 p-4 pt-0">
        {children}
        {((zoneType === 'dependent' && !dependentVariable) || (zoneType === 'values' && !valuesColumn) || (zoneType !== 'dependent' && zoneType !== 'values')) && (
          <div className="text-center text-muted-foreground p-4 border-2 border-dashed rounded-md">
            Drag column here
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">Drag and drop columns from the 'Available Columns' list into the appropriate variable boxes below.</p>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle className="font-headline text-md">Available Columns</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px] p-1">
              <div className="space-y-2">
                {availableColumns.length > 0 ? availableColumns.map(col => <DraggableColumn key={col.id} column={col} sourceType="available" />) : <p className="text-sm text-muted-foreground p-2">All columns assigned.</p>}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <div className="md:col-span-3 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <DropZone title="Dependent Variable" zoneType="dependent" description="The outcome you are measuring (usually one column)." singleItemOnly>
            {dependentVariable && <DraggableColumn column={dependentVariable} sourceType="dependent" />}
          </DropZone>
          <DropZone title="Independent Variables" zoneType="independent" description="Factors or predictors (can be multiple columns).">
            {independentVariables.map(col => <DraggableColumn key={col.id} column={col} sourceType="independent" />)}
          </DropZone>
          <DropZone title="Values Column" zoneType="values" description="Numerical data column (often used if data is 'long' or for specific plot types)." singleItemOnly>
            {valuesColumn && <DraggableColumn column={valuesColumn} sourceType="values" />}
          </DropZone>
          <DropZone title="Covariates (for ANCOVA)" zoneType="covariates" description="Continuous variables to control for (optional, can be multiple).">
            {covariates.map(col => <DraggableColumn key={col.id} column={col} sourceType="covariates" />)}
          </DropZone>
        </div>
      </div>
    </div>
  );
}
