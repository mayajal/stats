'use client';

import React, { useCallback, useState } from 'react';
import { UploadCloud, File as FileIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from "@/hooks/use-toast";

interface FileDropzoneProps {
  onFileAccepted: (file: File) => void;
  acceptedFileTypes?: string[]; // e.g., ['.csv', '.xlsx']
  maxFileSize?: number; // in bytes
}

export function FileDropzone({
  onFileAccepted,
  acceptedFileTypes = ['.csv', '.xlsx'],
  maxFileSize = 5 * 1024 * 1024, // 5MB default
}: FileDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const validateFile = useCallback((file: File): boolean => {
    if (!acceptedFileTypes.some(type => file.name.toLowerCase().endsWith(type) || file.type === type.replace('.', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'))) {
      const err = `Invalid file type. Accepted types: ${acceptedFileTypes.join(', ')}`;
      setError(err);
      toast({ title: "File Error", description: err, variant: "destructive" });
      return false;
    }
    if (file.size > maxFileSize) {
      const err = `File is too large. Max size: ${maxFileSize / (1024 * 1024)}MB.`;
      setError(err);
      toast({ title: "File Error", description: err, variant: "destructive" });
      return false;
    }
    setError(null);
    return true;
  }, [acceptedFileTypes, maxFileSize, toast]);

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        const file = e.dataTransfer.files[0];
        if (validateFile(file)) {
          onFileAccepted(file);
        }
        e.dataTransfer.clearData();
      }
    },
    [onFileAccepted, validateFile]
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      if (validateFile(file)) {
        onFileAccepted(file);
      }
    }
  };

  const handleBrowseClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <Card
      className={`border-2 border-dashed hover:border-primary transition-all duration-200 ${
        isDragging ? 'border-primary bg-accent/20' : 'border-border'
      }`}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <CardContent className="p-6 text-center">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept={acceptedFileTypes.join(',')}
          className="hidden"
          aria-label="File uploader"
        />
        <UploadCloud className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
        <p className="font-headline text-lg mb-2">Drag & drop your data file here</p>
        <p className="text-sm text-muted-foreground mb-4">
          Supports .csv and .xlsx files up to {maxFileSize / (1024 * 1024)}MB
        </p>
        <Button onClick={handleBrowseClick} variant="outline">
          <FileIcon className="mr-2 h-4 w-4" />
          Browse Files
        </Button>
        {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
