'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ArrowRight, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';

interface StepWrapperProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  onNext?: () => void;
  onBack?: () => void;
  isNextDisabled?: boolean;
  isBackDisabled?: boolean;
  nextButtonText?: string;
  backButtonText?: string;
  isFinalStep?: boolean;
  isLoading?: boolean;
}

export function StepWrapper({
  title,
  description,
  children,
  onNext,
  onBack,
  isNextDisabled = false,
  isBackDisabled = false,
  nextButtonText = 'Next',
  backButtonText = 'Back',
  isFinalStep = false,
  isLoading = false,
}: StepWrapperProps) {
  return (
    <Card className="w-full max-w-3xl mx-auto shadow-xl">
      <CardHeader>
        <CardTitle className="font-headline text-2xl tracking-tight">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="space-y-6">
        {children}
      </CardContent>
      {(onNext || onBack) && (
        <CardFooter className="flex justify-between pt-6">
          {onBack ? (
            <Button variant="outline" onClick={onBack} disabled={isBackDisabled || isLoading}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              {backButtonText}
            </Button>
          ) : <div /> /* Placeholder for spacing */}
          {onNext && !isFinalStep && (
            <Button onClick={onNext} disabled={isNextDisabled || isLoading}>
              {isLoading ? 'Processing...' : nextButtonText}
              {!isLoading && <ArrowRight className="ml-2 h-4 w-4" />}
            </Button>
          )}
          {onNext && isFinalStep && (
             <Button onClick={onNext} disabled={isNextDisabled || isLoading}>
              {isLoading ? 'Processing...' : nextButtonText}
              {!isLoading && <CheckCircle className="ml-2 h-4 w-4" />}
            </Button>
          )}
        </CardFooter>
      )}
    </Card>
  );
}
