import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Link } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

// enabling in later update
const ENABLE_DRAFTS = false;

export default function Index() {
    const [draftExists, setDraftExists] = useState(false)

    useEffect(() => {
        (async () => {
            try {
                const draft = await AsyncStorage.getItem("reflection_draft");
                console.log("Draft found:", draft);
                if (draft && draft !== '') {
                    setDraftExists(true);
                }
            } catch (e) {
                console.error("Failed to check draft:", e);
            }
        })();
    }, []);

    return (
        <View style={styles.container}>
            <View style={styles.titleContainer}>
                <Text style={styles.title}>Àṣàrò</Text>
                <View style={styles.titleUnderline} />
            </View>

            <View style={styles.updatesContainer}>
                <Text style={styles.updatesHeader}>
                    You'll get new updates info here:
                </Text>

                <Text style={styles.updatesContent}>
                    • Sept 6, 2025 @ 8:57 AM
                    {"\n"}Meditation question no. 5 (what do I want to remember?) has been removed.
                    {"\n"}{"\n"}The goal of this field was to help you remember topics from your Bible reading you want to research more on, but a simple text field won't actually help you remember.
                    {"\n"}{"\n"}So, there will be an upcoming feature that will help you set dates and reminders for topics you want to research further.
                </Text>
            </View>

            <View style={styles.buttonContainer}>
                <Link href="/addEntry" asChild>
                    <TouchableOpacity style={styles.primaryButton}>
                        <Text style={styles.primaryButtonText}>add entry 🧘</Text>
                    </TouchableOpacity>
                </Link>

                <Link href="/browse" asChild>
                    <TouchableOpacity style={styles.secondaryButton}>
                        <Text style={styles.secondaryButtonText}>past entries</Text>
                    </TouchableOpacity>
                </Link>

                {/* <Link href="/features" asChild>
                    <Text style={styles.featureLink}>what's next with Àṣàrò?</Text>
                </Link> */}
            </View>
            <View style={styles.ornament}></View>

            {(ENABLE_DRAFTS && draftExists) && (
                <View style={styles.draftBar}>
                    <Link href="/addEntry" asChild>
                        <TouchableOpacity style={styles.draftContent}>
                            <Text style={styles.draftText}>Continue?</Text>
                            <View style={styles.arrowCircle}>
                                <Ionicons name="arrow-forward" size={20} color="#8b7355" />
                            </View>
                        </TouchableOpacity>
                    </Link>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    draftBar: {
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        marginVertical: 20,
        marginHorizontal: 10,
        paddingVertical: 20,
        paddingHorizontal: 20,
        borderRadius: 40,
        backgroundColor: "rgba(139, 115, 85, 0.25)",
        borderColor: "rgba(139, 115, 85, 0.6)",
        borderCurve: "circular",
        borderWidth: 2.5,
        shadowColor: "rgba(139, 115, 85, 0.5)",
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.6,
        shadowRadius: 20,
        elevation: 15,
    },

    draftContent: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },

    draftText: {
        color: "#8b7355",
        fontSize: 16,
        fontWeight: "700",
        opacity: 0.9,
    },

    arrowCircle: {
        width: 40,
        height: 40,
        borderRadius: 20,
        borderWidth: 1.5,
        borderColor: "rgba(139, 115, 85, 0.5)",
        backgroundColor: "rgba(139, 115, 85, 0.2)",
        justifyContent: "center",
        alignItems: "center",
        shadowColor: "rgba(139, 115, 85, 0.4)",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.5,
        shadowRadius: 8,
        elevation: 6,
    },

    container: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        padding: 32,
        backgroundColor: "#f7f6f3",
    },
    titleContainer: {
        alignItems: "center",
        marginBottom: 16,
    },
    title: {
        fontSize: 32,
        fontWeight: "300",
        color: "#2d2520",
        letterSpacing: 2,
        textAlign: "center",
    },
    titleUnderline: {
        width: 60,
        height: 1,
        backgroundColor: "#8b7355",
        marginTop: 8,
        opacity: 0.6,
    },

    updatesContainer: {
        marginBottom: 48,
        alignItems: "center",
    },
    updatesHeader: {
        fontSize: 14,
        fontWeight: "300",
        color: "#6b5d52",
        textAlign: "center",
        letterSpacing: 0.5,
        lineHeight: 20,
        marginBottom: 16,
    },
    updatesContent: {
        fontSize: 14,
        fontWeight: "300",
        color: "#6b5d52",
        textAlign: "left",
        letterSpacing: 0.5,
        fontStyle: "italic",
        lineHeight: 20,
        alignSelf: "flex-start",
    },

    buttonContainer: {
        gap: 16,
        alignItems: "center",
    },
    primaryButton: {
        backgroundColor: "#4a4037",
        paddingHorizontal: 32,
        paddingVertical: 14,
        borderRadius: 2,
        minWidth: 160,
        alignItems: "center",
        shadowColor: "#2d2520",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 1,
    },
    primaryButtonText: {
        color: "#f8f6f0",
        fontSize: 14,
        fontWeight: "300",
        letterSpacing: 1,
    },
    secondaryButton: {
        backgroundColor: "transparent",
        paddingHorizontal: 32,
        paddingVertical: 14,
        borderWidth: 1,
        borderColor: "#8b7355",
        borderRadius: 2,
        minWidth: 160,
        alignItems: "center",
    },
    featureLink: {
        marginTop: 14,
        textDecorationLine: "underline",
        color: "#8b7355",
    },
    secondaryButtonText: {
        color: "#4a4037",
        fontSize: 14,
        fontWeight: "300",
        letterSpacing: 1,
    },
    ornament: {
        position: "absolute",
        bottom: 48,
        width: 1,
        height: 24,
        backgroundColor: "#8b7355",
        opacity: 0.3,
    },

    draftButton: {
        backgroundColor: "#8b7355",
        paddingHorizontal: 32,
        paddingVertical: 14,
        borderRadius: 2,
        minWidth: 160,
        alignItems: "center",
    },
    draftButtonText: {
        color: "#fefefe",
        fontSize: 14,
        fontWeight: "400",
        letterSpacing: 1,
    },
});