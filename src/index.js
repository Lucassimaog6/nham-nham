import { initializeApp } from "firebase/app";
import {
	getFirestore,
	collection,
	onSnapshot,
	addDoc,
} from "firebase/firestore";

const out = document.getElementById("list");
let comidas = [];

const firebaseConfig = {
	apiKey: "AIzaSyDX9bLiFbMwbAItbR_YPHGbCcIbOr8kWg0",
	authDomain: "nham-nham-82311.firebaseapp.com",
	projectId: "nham-nham-82311",
	storageBucket: "nham-nham-82311.appspot.com",
	messagingSenderId: "217495930982",
	appId: "1:217495930982:web:9467b313ca978fce8045a7",
};

initializeApp(firebaseConfig);
const db = getFirestore();
const colRef = collection(db, "comidas");

onSnapshot(colRef, (snapshot) => {
	comidas = [];
	snapshot.docs.forEach((doc) => {
		comidas.push({ ...doc.data() });
		reloadComidas();
	});
});

function reloadComidas() {
	out.replaceChildren();
	for (let i = 0; i < comidas.length; i++) {
		const item = document.createElement("li");
		item.className = "item";
		item.innerHTML = comidas[i].nome;
		out.appendChild(item);
	}
}

const addComidasForm = document.getElementById("add");
addComidasForm.addEventListener("submit", (e) => {
	e.preventDefault();
	addDoc(colRef, {
		nome: addComidasForm.nome.value,
	});
});
