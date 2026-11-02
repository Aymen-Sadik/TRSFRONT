# TRS Frontend

## 📌 Description

Ce projet correspond à l'interface utilisateur (Frontend) de l'application **TRS (Taux de Rendement Synthétique)**.

Développée avec **React**, **TypeScript** et **Vite**, cette application permet aux utilisateurs d'interagir avec l'API backend afin de consulter, gérer et suivre les données de production.

Le frontend communique avec le backend via une API REST et utilise également **SignalR** pour certaines fonctionnalités en temps réel.

---

## ✨ Fonctionnalités

Les fonctionnalités actuellement développées incluent notamment :

- 🔐 Authentification des utilisateurs
- 👤 Gestion des utilisateurs
- 📊 Consultation des données de production
- 🏭 Gestion des opérations
- ⏱️ Gestion du pointage
- 🔄 Communication en temps réel avec SignalR
- 📱 Interface responsive (en cours d'amélioration)

---

## 🛠️ Technologies utilisées

- React
- TypeScript
- Vite
- Tailwind CSS
- SignalR
- JavaScript (ES Modules)

---

## 🚧 État du projet

> **Projet en cours de développement.**

Certaines fonctionnalités sont encore en cours d'implémentation ou d'amélioration.

Les prochaines évolutions prévues sont :

- Amélioration de l'expérience utilisateur (UX)
- Optimisation des performances
- Finalisation de certaines pages
- Gestion avancée des erreurs
- Responsive Design complet
- Tests et corrections de bugs

---

## ⚙️ Installation

### Cloner le projet

```bash
git clone <url-du-repository>
```

### Installer les dépendances

```bash
npm install
```

### Configurer les variables d'environnement

Créer ou modifier le fichier `.env` afin d'indiquer l'adresse de l'API Backend.

Exemple :

```env
VITE_API_URL=http://localhost:5000
```

---

## ▶️ Lancer le projet

Mode développement :

```bash
npm run dev
```

Compilation pour la production :

```bash
npm run build
```

Prévisualisation :

```bash
npm run preview
```

---

## 📂 Structure du projet

```
src/
 ├── api/
 ├── assets/
 ├── components/
 ├── context/
 ├── pages/
 ├── hooks/
 ├── styles/
 └── App.tsx
```

---

## 🔗 Backend

Ce projet fonctionne conjointement avec le backend **TRS API**. Celui-ci doit être lancé avant le frontend afin d'assurer le bon fonctionnement des fonctionnalités nécessitant un accès aux données.

---

## 📌 Remarque

Ce dépôt est encore en phase de développement. La structure du projet, les composants ainsi que les fonctionnalités peuvent évoluer au cours des prochaines versions.

---

## 👨‍💻 Auteur

Projet développé dans le cadre d'une application de suivi du **Taux de Rendement Synthétique (TRS)**.

---

## 📄 Licence

Aucune licence définie pour le moment.
