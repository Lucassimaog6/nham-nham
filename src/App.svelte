<script>
	import { Button, FormItem, TextInput } from "@specialdoom/proi-ui";
	import { initializeApp } from "firebase/app";
	import {
		getFirestore,
		collection,
		onSnapshot,
		addDoc,
	} from "firebase/firestore";

	const firebaseConfig = {
		apiKey: "AIzaSyDX9bLiFbMwbAItbR_YPHGbCcIbOr8kWg0",
		authDomain: "nham-nham-82311.firebaseapp.com",
		projectId: "nham-nham-82311",
		storageBucket: "nham-nham-82311.appspot.com",
		messagingSenderId: "217495930982",
		appId: "1:217495930982:web:9467b313ca978fce8045a7",
	};

	let comidas = [];

	initializeApp(firebaseConfig);
	const db = getFirestore();
	const colRef = collection(db, "comidas");

	onSnapshot(colRef, (snapshot) => {
		comidas = [];
		snapshot.docs.forEach((doc) => {
			comidas.push({ ...doc.data() });
		});
	});

	let novaComida;
	function adicionaComida(){
		addDoc(colRef, {
			nome: novaComida,
		})
		novaComida = "";
	}
</script>

<main>
	<aside>
		<FormItem label="Nome" description="Defina o nome da comida">
			<TextInput bind:value={novaComida} placeholder="nham nham"/>
		</FormItem>
		<Button on:click={adicionaComida}>Adicionar</Button>
	</aside>
	<ul>
		{#each comidas as { nome }}
			<li>{nome}</li>
		{/each}
	</ul>
</main>

<style>
	@import url("https://fonts.googleapis.com/css2?family=Nunito&display=swap");
	main {
		min-height: 100vh;
		display: grid;
		grid-template-columns: auto 1fr;
		grid-template-areas: "aside ul";
		font-family: "Nunito", sans-serif;
	}
	aside {
		grid-area: aside;
		display: flex;
		flex-direction: column;
		align-items: center;
		border-right: 3px solid var(--g200);
		padding: 2rem;
	}
	ul {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		list-style: none;
	}
	li {
		font-size: 1.5rem;
	}
	@media screen and (max-width: 800px) {
		main{
			grid-template-columns: 1fr;
			grid-template-rows: auto 1fr;
			grid-template-areas: "aside"
														"ul";
		}
		aside{
			border-right: none;
			border-bottom: 3px solid var(--g200);
		}
	}
</style>
