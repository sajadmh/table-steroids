import * as React from "react";
import type { TableSpreadsheetOptions } from "../dom/enhance-table.js";
export interface TableSteroidsProps extends React.TableHTMLAttributes<HTMLTableElement>, TableSpreadsheetOptions {
    children?: React.ReactNode;
}
export declare const TableSteroids: React.ForwardRefExoticComponent<TableSteroidsProps & React.RefAttributes<HTMLTableElement>>;
