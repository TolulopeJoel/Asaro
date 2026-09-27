/** Firestore references for the groups model (design/GROUPS.md#data-model). */

import {
    FirebaseFirestoreTypes, collection, doc, getDocs, getDocsFromServer, getFirestore, query, where,
} from '@react-native-firebase/firestore';

/** Readable by members only while the group is open; each person writes their own. */
export type GroupCollection = 'readings' | 'shares' | 'practices' | 'milestones' | 'weeks';
/** What a person writes into a group, and deletes when they leave. */
export const OWN_COLLECTIONS: GroupCollection[] = ['readings', 'shares', 'practices', 'milestones', 'weeks'];
/** What pruning trims; milestones are kept. */
export const PRUNED_COLLECTIONS: GroupCollection[] = ['readings', 'shares', 'practices', 'weeks'];

const db = () => getFirestore();

export const codeRef = (code: string) => doc(db(), 'codes', code);
export const groupsRef = () => collection(db(), 'groups');
export const groupRef = (gid: string) => doc(db(), 'groups', gid);
export const membersRef = (gid: string) => collection(db(), 'groups', gid, 'members');
export const memberRef = (gid: string, uid: string) => doc(db(), 'groups', gid, 'members', uid);
export const groupCollection = (gid: string, name: GroupCollection) => collection(db(), 'groups', gid, name);
export const groupDocRef = (gid: string, name: GroupCollection, id: string) => doc(db(), 'groups', gid, name, id);
/** The whole-group reads counter for one week, readable by members any day. */
export const weekCountRef = (gid: string, weekKey: string) => doc(db(), 'groups', gid, 'weekCounts', weekKey);
export const userRef = (uid: string) => doc(db(), 'users', uid);
export const nudgesRef = (uid: string) => collection(db(), 'users', uid, 'nudges');
export const nudgeRef = (uid: string, id: string) => doc(db(), 'users', uid, 'nudges', id);

// The SDK's modular query typings do not line up with its own Query type, so the casts live here only.
type Query = FirebaseFirestoreTypes.Query;
type Snapshot = FirebaseFirestoreTypes.QuerySnapshot;

/** `query` with only `where` filters. */
export const select = (ref: Query, ...filters: ReturnType<typeof where>[]): Query =>
    (query as any)(ref, ...filters);

/** `getDocs`: the server when online, the cache when not. */
export const readQuery = (q: Query): Promise<Snapshot> => (getDocs as any)(q);
export const readQueryFromServer = (q: Query): Promise<Snapshot> => (getDocsFromServer as any)(q);
