import { DocumentsStore } from '../components/documents-store.js';
import { Index } from '../components/index.js';
import { Sorter } from '../components/sorter.js';
import { AnySchema, Components, IDocumentsStore, IIndex, IndexesConfig, ISorter, SorterConfig, ZBSearch, ZBSearchPlugin } from '../types.js';
interface CreateArguments<ZBSearchSchema, TIndex, TDocumentStore, TSorter, TPinning> {
    schema?: ZBSearchSchema;
    inferSchema?: boolean;
    indexes?: IndexesConfig;
    sort?: SorterConfig;
    language?: string;
    components?: Components<ZBSearch<ZBSearchSchema, TIndex, TDocumentStore, TSorter, TPinning>, ZBSearchSchema, TIndex, TDocumentStore, TSorter, TPinning>;
    plugins?: ZBSearchPlugin[];
    id?: string;
}
export declare function create<ZBSearchSchema extends AnySchema = any, TIndex = IIndex<Index>, TDocumentStore = IDocumentsStore<DocumentsStore>, TSorter = ISorter<Sorter>, TPinning = any>(args?: CreateArguments<ZBSearchSchema, TIndex, TDocumentStore, TSorter, TPinning>): ZBSearch<ZBSearchSchema, TIndex, TDocumentStore, TSorter, TPinning>;
export {};
