import type React from "react";
import { notFound } from "next/navigation";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Play } from "lucide-react";

/**
 * Isolated shadcn/MD3 fixture gallery for visual regression (not shown on main dashboard).
 * @returns Dev-only UI component showcase page.
 */
export default function DevUiGalleryPage(): React.JSX.Element {
  if (process.env.NODE_ENV === "production" && process.env.USE_MOCKS !== "1") {
    notFound();
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div data-testid="visual-test-fixtures" className="mx-auto max-w-5xl space-y-6">
        <h1 className="md3-title-large text-foreground">UI component gallery</h1>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <div data-testid="ui-button-hero" className="space-y-2 rounded-lg bg-background p-3">
            <Button className="w-full" size="lg">
              <Play className="mr-2 h-4 w-4" />
              Default
            </Button>
            <Button variant="secondary" data-testid="ui-button" className="w-full">
              Tonal
            </Button>
            <Button variant="outline" size="sm" className="w-full">
              Outlined
            </Button>
          </div>
          <div data-testid="ui-card-demo" className="rounded-lg bg-background p-1">
            <Card className="p-4">
              <CardTitle className="mb-2 text-sm">Card demo</CardTitle>
              <CardContent className="p-0 text-xs text-muted-foreground">Premium MD3 + shadcn surface</CardContent>
            </Card>
          </div>
          <div className="space-y-2">
            <div data-testid="ui-badge" className="rounded-lg bg-background p-3">
              <Badge variant="default">Active</Badge>
            </div>
            <div data-testid="ui-input" className="rounded-lg bg-background p-3">
              <Input placeholder="Search models…" />
            </div>
            <div data-testid="ui-skeleton" className="space-y-2 rounded-lg bg-background p-3">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          </div>
          <div data-testid="ui-table" className="rounded-lg bg-background p-3">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Size</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell>llama3</TableCell>
                  <TableCell>4.7 GB</TableCell>
                </TableRow>
                <TableRow className="bg-muted/30">
                  <TableCell>kimi-test</TableCell>
                  <TableCell>8.2 GB</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </div>
  );
}
