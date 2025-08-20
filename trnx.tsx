// // App.tsx
// import React, { useEffect, useState } from "react";
// import { View, Text, Button, FlatList, TouchableOpacity, TextInput, ScrollView } from "react-native";
// import * as SQLite from "expo-sqlite";
// import { NavigationContainer } from "@react-navigation/native";
// import { createNativeStackNavigator } from "@react-navigation/native-stack";

// const db = SQLite.openDatabaseSync("bible_journal.db");
// const Stack = createNativeStackNavigator();

// // Pre-seed minimal books (just a few to test)
// const books = [
//   { name: "Genesis", abbreviation: "Gen", chapters: 50 },
//   { name: "Exodus", abbreviation: "Exod", chapters: 40 },
//   { name: "Psalms", abbreviation: "Ps", chapters: 150 },
// ];

// function initDb() {
//   db.transaction(tx => {
//     tx.executeSql(`CREATE TABLE IF NOT EXISTS books (
//       id INTEGER PRIMARY KEY AUTOINCREMENT,
//       name TEXT NOT NULL,   
//       abbreviation TEXT
//     );`);

//     tx.executeSql(`CREATE TABLE IF NOT EXISTS chapters (
//       id INTEGER PRIMARY KEY AUTOINCREMENT,
//       book_id INTEGER NOT NULL,
//       number INTEGER NOT NULL,
//       FOREIGN KEY(book_id) REFERENCES books(id)
//     );`);

//     tx.executeSql(`CREATE TABLE IF NOT EXISTS journal_entries (
//       id INTEGER PRIMARY KEY AUTOINCREMENT,
//       book_id INTEGER NOT NULL,
//       start_chapter INTEGER NOT NULL,
//       end_chapter INTEGER,
//       verses TEXT,
//       answer1 TEXT,
//       answer2 TEXT,
//       answer3 TEXT,
//       answer4 TEXT,
//       created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
//       FOREIGN KEY(book_id) REFERENCES books(id)
//     );`);

//     // seed books + chapters if empty
//     tx.executeSql("SELECT COUNT(*) as count FROM books", [], (_, { rows }) => {
//       if (rows.item(0).count === 0) {
//         books.forEach(book => {
//           tx.executeSql(
//             "INSERT INTO books (name, abbreviation) VALUES (?, ?)",
//             [book.name, book.abbreviation],
//             (_, { insertId }) => {
//               for (let i = 1; i <= book.chapters; i++) {
//                 tx.executeSql(
//                   "INSERT INTO chapters (book_id, number) VALUES (?, ?)",
//                   [insertId, i]
//                 );
//               }
//             }
//           );
//         });
//       }
//     });
//   });
// }

// // 📚 Book List Screen
// function BooksScreen({ navigation }) {
//   const [books, setBooks] = useState([]);

//   useEffect(() => {
//     db.transaction(tx => {
//       tx.executeSql("SELECT * FROM books", [], (_, { rows }) => {
//         setBooks(rows._array);
//       });
//     });
//   }, []);

//   return (
//     <FlatList
//       data={books}
//       keyExtractor={item => item.id.toString()}
//       renderItem={({ item }) => (
//         <TouchableOpacity
//           onPress={() => navigation.navigate("Chapters", { book: item })}
//           style={{ padding: 15, borderBottomWidth: 1 }}
//         >
//           <Text style={{ fontSize: 18 }}>{item.name}</Text>
//         </TouchableOpacity>
//       )}
//     />
//   );
// }

// // 📖 Chapter Range Picker
// function ChaptersScreen({ route, navigation }) {
//   const { book } = route.params;
//   const [start, setStart] = useState("1");
//   const [end, setEnd] = useState("1");

//   return (
//     <View style={{ padding: 20 }}>
//       <Text style={{ fontSize: 18 }}>Select chapters in {book.name}</Text>
//       <Text>Start Chapter:</Text>
//       <TextInput
//         value={start}
//         onChangeText={setStart}
//         keyboardType="numeric"
//         style={{ borderWidth: 1, marginVertical: 5, padding: 5 }}
//       />
//       <Text>End Chapter:</Text>
//       <TextInput
//         value={end}
//         onChangeText={setEnd}
//         keyboardType="numeric"
//         style={{ borderWidth: 1, marginVertical: 5, padding: 5 }}
//       />
//       <Button
//         title="Start Reflection"
//         onPress={() =>
//           navigation.navigate("Journal", { book, start: parseInt(start), end: parseInt(end) })
//         }
//       />
//     </View>
//   );
// }

// // 📝 Journal Entry Form
// function JournalScreen({ route, navigation }) {
//   const { book, start, end } = route.params;
//   const [answers, setAnswers] = useState({ q1: "", q2: "", q3: "", q4: "" });

//   const saveEntry = () => {
//     db.transaction(tx => {
//       tx.executeSql(
//         "INSERT INTO journal_entries (book_id, start_chapter, end_chapter, answer1, answer2, answer3, answer4) VALUES (?, ?, ?, ?, ?, ?, ?)",
//         [book.id, start, end, answers.q1, answers.q2, answers.q3, answers.q4],
//         () => {
//           navigation.navigate("Entries");
//         }
//       );
//     });
//   };

//   return (
//     <ScrollView style={{ padding: 20 }}>
//       <Text style={{ fontSize: 20, fontWeight: "bold" }}>
//         {book.name} {start}–{end}
//       </Text>

//       {["What did I learn about Jehovah?",
//         "What lesson can I apply?",
//         "How does this strengthen my faith?",
//         "What verse stood out?"].map((q, idx) => (
//         <View key={idx} style={{ marginVertical: 10 }}>
//           <Text>{q}</Text>
//           <TextInput
//             multiline
//             style={{ borderWidth: 1, padding: 8, minHeight: 60 }}
//             value={answers[`q${idx + 1}`]}
//             onChangeText={txt => setAnswers(prev => ({ ...prev, [`q${idx + 1}`]: txt }))}
//           />
//         </View>
//       ))}

//       <Button title="Save Reflection" onPress={saveEntry} />
//     </ScrollView>
//   );
// }

// // 📂 Saved Entries
// function EntriesScreen() {
//   const [entries, setEntries] = useState([]);

//   useEffect(() => {
//     db.transaction(tx => {
//       tx.executeSql(
//         `SELECT e.id, b.name as book, e.start_chapter, e.end_chapter, e.created_at
//          FROM journal_entries e
//          JOIN books b ON e.book_id = b.id
//          ORDER BY e.created_at DESC`,
//         [],
//         (_, { rows }) => setEntries(rows._array)
//       );
//     });
//   }, []);

//   return (
//     <FlatList
//       data={entries}
//       keyExtractor={item => item.id.toString()}
//       renderItem={({ item }) => (
//         <View style={{ padding: 15, borderBottomWidth: 1 }}>
//           <Text style={{ fontSize: 16 }}>
//             {item.book} {item.start_chapter}–{item.end_chapter}
//           </Text>
//           <Text style={{ fontSize: 12, color: "gray" }}>{item.created_at}</Text>
//         </View>
//       )}
//     />
//   );
// }

// export default function App() {
//   useEffect(() => {
//     initDb();
//   }, []);

//   return (
//     <NavigationContainer>
//       <Stack.Navigator>
//         <Stack.Screen name="Books" component={BooksScreen} />
//         <Stack.Screen name="Chapters" component={ChaptersScreen} />
//         <Stack.Screen name="Journal" component={JournalScreen} />
//         <Stack.Screen name="Entries" component={EntriesScreen} />
//       </Stack.Navigator>
//     </NavigationContainer>
//   );
// }
