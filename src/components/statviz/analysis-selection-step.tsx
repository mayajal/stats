'use client';

import React from 'react';
import type { AnalysisType } from '@/types';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, BarChartBig, Sigma, FunctionSquare } from 'lucide-react'; // Sigma for ANOVA/ANCOVA, FunctionSquare for Regression

interface AnalysisSelectionStepProps {
  selectedAnalysis: AnalysisType | null;
  onAnalysisSelected: (analysis: AnalysisType) => void;
}

const analysisOptions: { value: AnalysisType; label: string; description: string; icon: React.ElementType }[] = [
  { value: 'ANOVA', label: 'ANOVA', description: 'Compare means of two or more groups.', icon: BarChartBig },
  { value: 'ANCOVA', label: 'ANCOVA', description: 'Compare means while controlling for covariates.', icon: Sigma },
  { value: "Tukey's HSD", label: "Tukey's HSD", description: 'Post-hoc test for pairwise comparisons after ANOVA.', icon: BarChartBig },
  { value: 'Linear Regression', label: 'Linear Regression', description: 'Model relationship between variables.', icon: LineChart },
];

export function AnalysisSelectionStep({ selectedAnalysis, onAnalysisSelected }: AnalysisSelectionStepProps) {
  return (
    <RadioGroup
      value={selectedAnalysis || undefined}
      onValueChange={(value) => onAnalysisSelected(value as AnalysisType)}
      className="grid grid-cols-1 md:grid-cols-2 gap-4"
      aria-label="Select statistical analysis method"
    >
      {analysisOptions.map((option) => (
        <Label htmlFor={option.value} key={option.value} className="cursor-pointer">
          <Card className={`hover:border-primary transition-all ${selectedAnalysis === option.value ? 'border-primary ring-2 ring-primary' : ''}`}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="font-headline text-lg">{option.label}</CardTitle>
              <option.icon className="h-6 w-6 text-primary" />
            </CardHeader>
            <CardContent>
              <CardDescription className="text-sm mb-4">{option.description}</CardDescription>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value={option.value} id={option.value} />
                <span className="text-sm font-medium">Select {option.label}</span>
              </div>
            </CardContent>
          </Card>
        </Label>
      ))}
    </RadioGroup>
  );
}
