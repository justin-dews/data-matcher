import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Upload } from 'lucide-react';

interface LineItem {
  id: string;
  item_number?: string;
  part_number?: string;
  description?: string;
  raw_text: string;
  normalized_text: string;
  quantity: number | null;
  unit_price: number | null;
  total?: number | null;
  position: number;
}

interface DocumentData {
  id: string;
  filename: string;
  lineItems: LineItem[];
}

export default function UploadParse() {
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [documentData, setDocumentData] = useState<DocumentData | null>(null);
  const [progress, setProgress] = useState(0);
  const { toast } = useToast();
  const { user } = useAuth();

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile && selectedFile.type === 'application/pdf') {
      setFile(selectedFile);
      setDocumentData(null); // Clear previous results
    } else {
      toast({
        title: "Invalid File",
        description: "Please select a PDF file.",
        variant: "destructive",
      });
    }
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const droppedFile = event.dataTransfer.files[0];
    if (droppedFile && droppedFile.type === 'application/pdf') {
      setFile(droppedFile);
      setDocumentData(null); // Clear previous results
    } else {
      toast({
        title: "Invalid File",
        description: "Please drop a PDF file.",
        variant: "destructive",
      });
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  const handleParse = async () => {
    if (!file || !user) return;

    setParsing(true);
    setProgress(0);

    try {
      // Upload file to Supabase Storage
      setProgress(20);
      const fileName = `${user.id}/${Date.now()}-${file.name}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('documents')
        .upload(fileName, file);

      if (uploadError) {
        throw new Error(`Upload failed: ${uploadError.message}`);
      }

      setProgress(40);

      // Create document record
      const { data: documentRecord, error: documentError } = await supabase
        .from('documents')
        .insert({
          filename: file.name,
          storage_path: fileName,
          doc_type: 'invoice',
          created_by: user.id,
        })
        .select()
        .single();

      if (documentError) {
        throw new Error(`Database error: ${documentError.message}`);
      }

      setProgress(60);

      // Call parse-pdf edge function
      const { data: parseData, error: parseError } = await supabase.functions
        .invoke('parse-pdf', {
          body: {
            storagePath: fileName,
            schema: 'invoice'
          }
        });

      if (parseError) {
        throw new Error(`Parse error: ${parseError.message}`);
      }

      setProgress(80);

      // Insert line items
      const lineItemsToInsert = parseData.lineItems.map((item: LineItem) => ({
        document_id: documentRecord.id,
        raw_text: item.raw_text,
        normalized_text: item.normalized_text,
        quantity: item.quantity,
        unit_price: item.unit_price,
        position: item.position,
      }));

      const { data: insertedLineItems, error: lineItemsError } = await supabase
        .from('line_items')
        .insert(lineItemsToInsert)
        .select();

      if (lineItemsError) {
        throw new Error(`Line items error: ${lineItemsError.message}`);
      }

      setProgress(100);
      
      // Store document data with full parsed line items for display
      setDocumentData({
        id: documentRecord.id,
        filename: file.name,
        lineItems: parseData.lineItems // Use the full parsed data with all fields
      });

      // Update document status
      await supabase
        .from('documents')
        .update({ 
          parse_status: 'completed',
          parse_json: { lineItems: parseData.lineItems, metadata: parseData.metadata }
        })
        .eq('id', documentRecord.id);

      // Log activity
      await supabase
        .from('activity')
        .insert({
          event_type: 'parse_complete',
          actor: user.id,
          payload: {
            document_id: documentRecord.id,
            filename: file.name,
            line_count: parseData.lineItems.length
          }
        });

      toast({
        title: "Parsing Complete",
        description: `Successfully parsed ${parseData.lineItems.length} line items.`,
      });

    } catch (error) {
      console.error('Parse error:', error);
      toast({
        title: "Parsing Failed",
        description: error instanceof Error ? error.message : "An unexpected error occurred.",
        variant: "destructive",
      });
    } finally {
      setParsing(false);
      setProgress(0);
    }
  };

  const handleEditLineItem = (id: string, newText: string) => {
    if (!documentData) return;
    
    setDocumentData(prev => ({
      ...prev!,
      lineItems: prev!.lineItems.map(item => 
        item.id === id 
          ? { ...item, raw_text: newText, normalized_text: newText.toLowerCase().trim() }
          : item
      )
    }));
  };

  const navigateToMatching = () => {
    window.location.href = '/matching';
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Upload & Parse</h1>
        <p className="text-muted-foreground">
          Drop a PDF quote or invoice to extract line items automatically.
        </p>
      </div>

      {/* File Upload Area */}
      {!documentData && (
        <Card>
          <CardHeader>
            <CardTitle>Upload Document</CardTitle>
            <CardDescription>
              Upload a PDF invoice or quote for parsing. Use the Invoice/Quote preset for best results.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div
              className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onClick={() => document.getElementById('file-input')?.click()}
            >
              <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              {file ? (
                <div>
                  <p className="text-lg font-medium">{file.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-lg font-medium mb-2">
                    Drop a PDF here or click to select
                  </p>
                  <p className="text-sm text-muted-foreground">
                    PDF files up to 20MB supported
                  </p>
                </div>
              )}
              <input
                id="file-input"
                type="file"
                accept=".pdf"
                onChange={handleFileSelect}
                className="hidden"
                disabled={parsing}
              />
            </div>
            
            {file && (
              <div className="mt-4 flex justify-center">
                <Button 
                  onClick={handleParse} 
                  disabled={parsing}
                  size="lg"
                >
                  {parsing ? 'Parsing...' : 'Run Parsing'}
                </Button>
              </div>
            )}

            {parsing && (
              <div className="mt-4">
                <Progress value={progress} className="w-full" />
                <p className="text-sm text-center mt-2 text-muted-foreground">
                  Processing your document...
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Parsed Line Items */}
      {documentData && (
        <Card>
          <CardHeader>
            <CardTitle>Extracted Line Items ({documentData.lineItems.length})</CardTitle>
            <CardDescription>
              Review and edit line items before running matching. Click any text to edit.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2 text-sm font-medium text-muted-foreground">Item ID</th>
                    {documentData.lineItems.some(item => item.part_number) && (
                      <th className="text-left p-2 text-sm font-medium text-muted-foreground">Part Number</th>
                    )}
                    <th className="text-left p-2 text-sm font-medium text-muted-foreground">Description</th>
                    <th className="text-left p-2 text-sm font-medium text-muted-foreground">Qty</th>
                    <th className="text-left p-2 text-sm font-medium text-muted-foreground">Unit Price</th>
                    <th className="text-left p-2 text-sm font-medium text-muted-foreground">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {documentData.lineItems.map((item) => (
                    <tr key={item.id} className="border-b hover:bg-muted/50">
                      <td className="p-2 text-sm">{item.item_number}</td>
                      {documentData.lineItems.some(item => item.part_number) && (
                        <td className="p-2 text-sm">{item.part_number}</td>
                      )}
                      <td className="p-2 text-sm max-w-md">
                        <input
                          type="text"
                          value={item.description || item.raw_text}
                          onChange={(e) => handleEditLineItem(item.id, e.target.value)}
                          className="w-full bg-transparent border-none outline-none focus:bg-background focus:border focus:border-primary rounded px-2 py-1"
                        />
                      </td>
                      <td className="p-2 text-sm">{item.quantity || ''}</td>
                      <td className="p-2 text-sm">{item.unit_price ? `$${item.unit_price.toFixed(2)}` : ''}</td>
                      <td className="p-2 text-sm">{item.total ? `$${item.total.toFixed(2)}` : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            <div className="mt-6 flex gap-2">
              <Button onClick={() => {
                setFile(null);
                setDocumentData(null);
              }}>
                Upload Another Document
              </Button>
              <Button variant="default" onClick={navigateToMatching}>
                Run Matching
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}