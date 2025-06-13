
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
      <CardContent className="p-3 text-center"> {/* Reduced padding from p-6 to p-3 */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept={acceptedFileTypes.join(',')}
          className="hidden"
          aria-label="File uploader"
        />
        <div className="flex flex-col items-center gap-2 sm:flex-row sm:justify-center sm:gap-3">
          <div className="flex items-center gap-2">
            <UploadCloud className="h-7 w-7 text-muted-foreground flex-shrink-0" />
            <p className="text-sm font-medium text-foreground">
              Drag & drop or
            </p>
          </div>
          <Button onClick={handleBrowseClick} variant="outline" size="sm" className="px-3 py-1.5 text-sm h-auto">
            <FileIcon className="mr-1.5 h-4 w-4" />
            Browse Files
          </Button>
          <p className="text-xs text-muted-foreground sm:whitespace-nowrap">
            (Supports .csv, .xlsx up to {maxFileSize / (1024 * 1024)}MB)
          </p>
        </div>
        {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
