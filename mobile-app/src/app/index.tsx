import { useEffect, useState } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, Alert } from 'react-native';
import { io } from 'socket.io-client';

const BACKEND_URL = "http://192.168.1.5:3000";
const QUEUE_ID = "60cc4028-3d4c-4ea1-a877-5be5491224ce";

const socket = io(BACKEND_URL);

export default function App() {
  const [phone, setPhone] = useState('');
  const [myToken, setMyToken] = useState(null);
  const [activeToken, setActiveToken] = useState(null);

  useEffect(() => {
    fetch(`${BACKEND_URL}/api/queues/${QUEUE_ID}/state`)
      .then(res => res.json())
      .then(data => setActiveToken(data.activeToken))
      .catch(err => console.log("Fetch error:", err));

    socket.emit("join_queue", QUEUE_ID);

    socket.on("queue_updated", (newState) => {
      setActiveToken(newState.activeToken);
    });

    return () => socket.off("queue_updated");
  }, []);

  const requestToken = async () => {
    if (!phone) return Alert.alert("Enter your phone number");
    
    try {
      const res = await fetch(`${BACKEND_URL}/api/tokens`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ queueId: QUEUE_ID, phone })
      });
      
      if (!res.ok) throw new Error("Failed to get token");
      
      const data = await res.json();
      setMyToken(data);
    } catch (error) {
      Alert.alert("Server Error", "Make sure your backend is running and the IP is correct.");
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>My First Clinic</Text>
      
      <View style={styles.card}>
        <Text style={styles.subtitle}>Now Serving</Text>
        <Text style={styles.bigNumber}>{activeToken ? activeToken.tokenNumber : "--"}</Text>
      </View>

      {!myToken ? (
        <View style={styles.inputContainer}>
          <TextInput 
            style={styles.input} 
            placeholder="Enter Phone (e.g. 555-0198)" 
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
          />
          <TouchableOpacity style={styles.button} onPress={requestToken}>
            <Text style={styles.buttonText}>Get Token</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={[styles.card, styles.myTokenCard]}>
          <Text style={styles.subtitle}>Your Token</Text>
          <Text style={styles.bigNumber}>{myToken.tokenNumber}</Text>
          <Text style={styles.status}>
            {activeToken?.tokenNumber === myToken.tokenNumber 
              ? "It's your turn! Proceed to the desk." 
              : "Please wait for your number..."}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center', padding: 20 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#1f2937', marginBottom: 30 },
  card: { backgroundColor: '#2563eb', padding: 30, borderRadius: 20, width: '100%', alignItems: 'center', marginBottom: 30, elevation: 5 },
  myTokenCard: { backgroundColor: '#10b981' },
  subtitle: { color: '#e0e7ff', fontSize: 18, fontWeight: '600', marginBottom: 10 },
  bigNumber: { color: 'white', fontSize: 72, fontWeight: '900' },
  status: { color: 'white', fontSize: 16, marginTop: 10, fontWeight: '600' },
  inputContainer: { width: '100%' },
  input: { backgroundColor: 'white', padding: 15, borderRadius: 10, fontSize: 16, marginBottom: 15, borderWidth: 1, borderColor: '#d1d5db' },
  button: { backgroundColor: '#1f2937', padding: 18, borderRadius: 10, alignItems: 'center' },
  buttonText: { color: 'white', fontSize: 18, fontWeight: 'bold' }
});