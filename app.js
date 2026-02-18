// Importa las funciones que necesitas de los SDKs de Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.10.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/9.10.0/firebase-auth.js";
import { getDatabase, ref, onValue, get, query, limitToLast, orderByChild } from "https://www.gstatic.com/firebasejs/9.10.0/firebase-database.js";

// --- CONFIGURACIÓN DE FIREBASE ---
// ¡IMPORTANTE! Reemplaza esto con la configuración de tu propio proyecto de Firebase.
// La puedes encontrar en tu consola de Firebase -> Configuración del proyecto -> Tus apps -> Configuración del SDK.
const firebaseConfig = {
  apiKey: "AIzaSyCNZ4r0KUzA8_vb2U4Hbo8r9cM-xrgZlD8",
  authDomain: "esp-proyectofinal.firebaseapp.com",
  databaseURL: "https://esp-proyectofinal-default-rtdb.firebaseio.com",
  projectId: "esp-proyectofinal",
  storageBucket: "esp-proyectofinal.firebasestorage.app",
  messagingSenderId: "1006608170439",
  appId: "1:1006608170439:web:3538bd8371a814d78f2de2"
};

// --- CREDENCIALES DE USUARIO ---
// Las mismas que usaste en el ESP32.
// ADVERTENCIA: Hardcodear credenciales aquí no es seguro para producción.
// Esto es solo para fines de este proyecto de ejemplo.
const email = "tomas.valori@gmail.com";
const password = "Proyecto2026";

// --- INICIALIZACIÓN ---
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const database = getDatabase(app);

// --- GRÁFICOS ---
const MAX_DATA_POINTS = 30; // Número máximo de puntos a mostrar en los gráficos

// Función para crear un gráfico
function createChart(ctx, label, scaleType = 'linear') {
    return new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: label,
                data: [],
                borderColor: '#e94560',
                backgroundColor: 'rgba(233, 69, 96, 0.2)',
                borderWidth: 2,
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            maintainAspectRatio: false, // Permite ajustar la altura mediante CSS en el contenedor
            scales: {
                x: {
                    ticks: { color: '#e0e0e0' },
                    grid: { color: 'rgba(224, 224, 224, 0.1)' }
                },
                y: {
                    type: scaleType,
                    beginAtZero: scaleType === 'linear', // Solo forzar 0 en escalas lineales
                    ticks: { color: '#e0e0e0' },
                    grid: { color: 'rgba(224, 224, 224, 0.1)' }
                }
            },
            plugins: {
                legend: {
                    labels: {
                        color: '#e0e0e0'
                    }
                }
            }
        }
    });
}

const tempChart = createChart(document.getElementById('tempChart').getContext('2d'), 'Temperatura');
const humChart = createChart(document.getElementById('humChart').getContext('2d'), 'Humedad');
const presChart = createChart(document.getElementById('presChart').getContext('2d'), 'Presión');
const luxChart = createChart(document.getElementById('luxChart').getContext('2d'), 'Luminosidad', 'logarithmic');
const toluenoChart = createChart(document.getElementById('toluenoChart').getContext('2d'), 'Tolueno', 'logarithmic');
const noiseChart = createChart(document.getElementById('noiseChart').getContext('2d'), 'Ruido');

// --- LÓGICA PRINCIPAL ---

// Función para actualizar los gráficos y el estado
function updateUI(data) {
    // Convertir el objeto de datos en un array y ordenarlo por clave (tiempo)
    const dataArray = Object.keys(data).map(key => ({ key, ...data[key] }));
    dataArray.sort((a, b) => a.key.localeCompare(b.key));

    // Limitar al número máximo de puntos
    const recentData = dataArray.slice(-MAX_DATA_POINTS);

    // Preparar los datos para los gráficos
    const labels = recentData.map(d => new Date(d.timestamp || firebasePushKeyToTimestamp(d.key)).toLocaleTimeString());
    const tempData = recentData.map(d => d.temperatura);
    const humData = recentData.map(d => d.humedad);
    const presData = recentData.map(d => d.presion);
    const luxData = recentData.map(d => d.luz);
    const toluenoData = recentData.map(d => d.tolueno);
    const noiseData = recentData.map(d => d.ruido || 0);

    // Actualizar gráficos
    updateChartData(tempChart, labels, tempData);
    updateChartData(humChart, labels, humData);
    updateChartData(presChart, labels, presData);
    updateChartData(luxChart, labels, luxData);
    updateChartData(toluenoChart, labels, toluenoData);
    updateChartData(noiseChart, labels, noiseData); 
}

function updateChartData(chart, labels, data) {
    chart.data.labels = labels;
    chart.data.datasets[0].data = data;
    chart.update();
}

// Firebase genera push keys que contienen un timestamp. Esta función lo extrae.
function firebasePushKeyToTimestamp(pushKey) {
    const PUSH_CHARS = '-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz';
    let timestamp = 0;
    for (let i = 0; i < 8; i++) {
        timestamp = timestamp * 64 + PUSH_CHARS.indexOf(pushKey.charAt(i));
    }
    return timestamp;
}

// Función para escuchar los datos de los sensores en tiempo real
function listenToSensorData() {
    const sensorsRef = ref(database, 'sensores');
    // Usamos una query para obtener solo los últimos N resultados para no cargar todo el historial
    const recentDataQuery = query(sensorsRef, limitToLast(MAX_DATA_POINTS));

    onValue(recentDataQuery, (snapshot) => {
        if (snapshot.exists()) {
            const data = snapshot.val();
            console.log("Datos recibidos de Firebase (Tiempo Real):", data);
            updateUI(data);
        } else {
            console.log("No hay datos de sensores disponibles.");
        }
    });
}

// --- DESCARGA DE DATOS ---
async function downloadDataAsCSV() {
    console.log("Iniciando descarga de datos...");
    const downloadBtn = document.getElementById('download-btn');
    downloadBtn.textContent = 'Cargando...';
    downloadBtn.disabled = true;

    try {
        const sensorsRef = ref(database, 'sensores');
        const snapshot = await get(sensorsRef);

        if (!snapshot.exists()) {
            alert("No hay datos para descargar.");
            return;
        }

        const data = snapshot.val();
        console.log("Datos completos para CSV:", data);
        let csvContent = "timestamp,temperatura,humedad,presion,luz,ruido,tolueno\n";

        for (const key in data) {
            const record = data[key];
            const timestamp = new Date(record.timestamp || firebasePushKeyToTimestamp(key)).toISOString();
            const row = [
                timestamp,
                record.temperatura || 0,
                record.humedad || 0,
                record.presion || 0,
                record.luz || 0,
                record.ruido || 0,
                record.tolueno || 0
            ].join(',');
            csvContent += row + "\n";
        }

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute("href", url);
            link.setAttribute("download", "datos_sensores_esp32.csv");
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    } catch (error) {
        console.error("Error al descargar los datos:", error);
        alert("Hubo un error al descargar los datos.");
    } finally {
        downloadBtn.textContent = 'Descargar CSV';
        downloadBtn.disabled = false;
    }
}

// --- INICIO DE LA APP ---
document.addEventListener('DOMContentLoaded', () => {
    // Autenticar y empezar a escuchar
    signInWithEmailAndPassword(auth, email, password)
      .then((userCredential) => {
        console.log("Autenticación con Firebase exitosa.");
        listenToSensorData();
      })
      .catch((error) => {
        console.error("Fallo la autenticación con Firebase:", error);
        alert("No se pudo conectar a Firebase. Revisa las credenciales y la configuración.");
      });

    // Asignar evento al botón de descarga
    document.getElementById('download-btn').addEventListener('click', downloadDataAsCSV);
});
