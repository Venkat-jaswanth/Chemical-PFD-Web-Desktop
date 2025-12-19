// src/components/Export/ExportReportModal.tsx
import React, { useMemo } from "react";
import { useEditorStore } from "@/store/useEditorStore";
import {
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Spinner,
  Button,
} from "@heroui/react";

interface ExportReportModalProps {
  editorId: string;
  open: boolean;
  onClose: () => void;
}

interface ReportItem {
  slNo: number;
  tagNo: string;
  type: string;
  description: string;
  sequence?: number;
  // Add other properties as needed
}

export const ExportReportModal: React.FC<ExportReportModalProps> = ({
  editorId,
  open,
  onClose,
}) => {
  const editorState = useEditorStore((s) => s.editors[editorId]);

  // Transform editor items to report items
  const items = useMemo(() => {
    if (!editorState?.items) return [];
    
    return [...editorState.items]
      .sort((a, b) => (a.sequence || 0) - (b.sequence || 0))
      .map((item, index) => ({
        slNo: index + 1,
        tagNo: item.tagNo || item.id || `TAG-${index + 1}`,
        type: item.type || "N/A",
        description: item.description || item.name || "No description",
        // Include the original item for reference if needed
        originalItem: item
      })) as ReportItem[];
  }, [editorState]);

  // Function to export to CSV
  const exportToCSV = (items: ReportItem[]) => {
    const headers = ["Sl No", "Tag No", "Type", "Description"];
    const csvContent = [
      headers.join(","),
      ...items.map(item => 
        `"${item.slNo}","${item.tagNo}","${item.type}","${item.description}"`
      )
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `equipment-report-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Handle Print/PDF
  const handlePrint = () => {
    // You might want to create a print-friendly version
    // For now, using window.print() directly
    window.print();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-[900px] rounded-xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h2 className="text-lg font-semibold">Export Equipment Report</h2>
          <button 
            onClick={onClose} 
            className="text-gray-500 hover:text-black text-xl p-1"
          >
            ✕
          </button>
        </div>

        {/* HeroUI Table */}
        <div className="max-h-[420px] overflow-auto px-6 py-4">
          <Table
            aria-label="Equipment Report Table"
            classNames={{
              base: "w-full",
              table: "min-h-[200px]",
            }}
            bottomContent={
              items.length > 0 ? (
                <div className="flex justify-end p-2">
                  <div className="text-sm text-gray-500">
                    Total: {items.length} items
                  </div>
                </div>
              ) : null
            }
          >
            <TableHeader>
              <TableColumn key="slNo" className="w-16">Sl No</TableColumn>
              <TableColumn key="tagNo" className="w-40">Tag No</TableColumn>
              <TableColumn key="type" className="w-48">Type</TableColumn>
              <TableColumn key="description">Description</TableColumn>
            </TableHeader>
            <TableBody
              items={items}
              emptyContent={
                <div className="py-12 text-center text-gray-500">
                  No components found in this diagram
                </div>
              }
            >
              {(item) => (
                <TableRow key={`${item.slNo}-${item.tagNo}`}>
                  {(columnKey) => (
                    <TableCell>
                      {item[columnKey as keyof ReportItem]}
                    </TableCell>
                  )}
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t px-6 py-4">
          <Button
            onPress={onClose}
            variant="bordered"
            className="text-sm"
          >
            Cancel
          </Button>

          <Button
            onPress={() => exportToCSV(items)}
            color="primary"
            className="text-sm"
            isDisabled={items.length === 0}
          >
            Export CSV
          </Button>

          <Button
            onPress={handlePrint}
            className="text-sm bg-gray-800 text-white hover:bg-black"
            isDisabled={items.length === 0}
          >
            Print / PDF
          </Button>
        </div>
      </div>
    </div>
  );
};