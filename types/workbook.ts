export type ChangeType =
  | 'formula_changed'
  | 'value_changed'
  | 'sheet_added'
  | 'sheet_removed'
  | 'row_inserted'
  | 'row_deleted'
  | 'column_inserted'
  | 'column_deleted'
  | 'named_range_changed'
  | 'vba_module_added'
  | 'vba_module_modified'
  | 'vba_module_deleted'
  | 'data_validation_changed'
  | 'conditional_format_changed';

export type Severity = 'critical' | 'warning' | 'info';

export interface CellChange {
  sheet: string;
  cell: string;           // e.g. "B12"
  changeType: ChangeType;
  oldValue?: string | number | null;
  newValue?: string | number | null;
  oldFormula?: string;
  newFormula?: string;
  deviationPercent?: number;
}

export interface VBAChange {
  moduleName: string;
  changeType: 'added' | 'modified' | 'deleted';
  oldCode?: string;
  newCode?: string;
  aiSummary?: string;
}

export interface StructuralChange {
  changeType: ChangeType;
  target: string;         // sheet name, range, etc.
  detail: string;
}

export interface SemanticDiff {
  cellChanges: CellChange[];
  vbaChanges: VBAChange[];
  structuralChanges: StructuralChange[];
  totalChanges: number;
}

export interface AnomalyFlag {
  id: string;
  severity: Severity;
  category:
    | 'formula_broken'
    | 'hardcoded_override'
    | 'vba_risk'
    | 'value_outlier'
    | 'ref_error'
    | 'structural_deletion'
    | 'unexpected_modification';
  title: string;
  description: string;
  affectedCell?: string;
  affectedSheet?: string;
  aiInferredCause?: string;  // always labeled [Inference]
  status: 'open' | 'resolved' | 'dismissed';
  resolvedBy?: string;
  resolvedAt?: string;
  resolutionNote?: string;
}

export interface WorkbookVersion {
  id: string;
  workbookId: string;
  versionNumber: number;
  uploadedBy: string;
  uploadedAt: string;
  fileName: string;
  fileHash: string;
  blobUrl: string;
  diff?: SemanticDiff;
  anomalies: AnomalyFlag[];
  aiSummary: string;
  aiInferredChangeReason?: string;  // labeled [Inference]
}

export interface Workbook {
  id: string;
  name: string;
  description?: string;
  createdBy: string;
  createdAt: string;
  lastModifiedAt: string;
  versions: WorkbookVersion[];
  latestVersion?: WorkbookVersion;
  healthScore: number;   // 0-100
  openFlagCount: number;
}
