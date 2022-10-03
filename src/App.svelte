<script>
	import {Button, FormItem, TextInput, Dialog, Switch} from "@specialdoom/proi-ui";
	import {initializeApp} from "firebase/app";
	import {addDoc, collection, getFirestore, onSnapshot, doc, deleteDoc} from "firebase/firestore";
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
            comidas.push({...doc.data(), id: doc.id});
        });
    });



    let showDialog = false;
    function verificaErros(){
        console.log(comidas)
        if (novaComida === undefined || novaComida === ""){
            showDialog = true;
            return false;
        }
        else{
            return true;
        }
    }

    let novaComida;
    function adicionaComida() {
        if(verificaErros()){
            addDoc(colRef, {
                nome: novaComida,
            })
        }
        novaComida = "";
    }

    function removeComida(id){
        const docRef = doc(db, 'comidas', id);
        deleteDoc(docRef);
    }

    let darkMode = false;
    function toggle() {
        console.log(darkMode)
        window.document.body.classList.toggle('dark-mode', !darkMode)
    }

</script>

<main>
    <Dialog visible={showDialog} title="Erro!" showActions={false}>
        Não deixe imputs vazios!
    </Dialog>

    <aside>
        <div on:click={toggle} ><Switch bind:checked={darkMode}/></div>
        <FormItem description="Defina o nome da comida a ser adicionada" label="Adicionar">
            <TextInput bind:value={novaComida} placeholder="nham nham"/>
        </FormItem>
        <Button on:click={adicionaComida}>Adicionar</Button>
    </aside>
    <ul>
        {#each comidas as {nome, id}}
            <li>{nome} <Button on:click={() => removeComida(id)}>Deletar</Button>  </li>
        {/each}
    </ul>
</main>

<style>
    @import url("https://fonts.googleapis.com/css2?family=Nunito&display=swap");

    :global(body) {
        background-color: var(--n0);
        color: var(--n800);
        transition: background-color 300ms, color 300ms;
    }
    :global(body.dark-mode) {
        background-color: var(--n800);
        color: var(--n0);
    }

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

    aside div{
        position: absolute;
        top: 2rem;
        right: 1.6rem;
    }

    @media screen and (max-width: 800px) {
        main {
            grid-template-columns: 1fr;
            grid-template-rows: auto 1fr;
            grid-template-areas: "aside"
            "ul";
        }

        aside {
            border-right: none;
            border-bottom: 3px solid var(--g200);
        }

        aside div{
            top: 1rem;
            right: .6rem;
        }
    }
</style>
