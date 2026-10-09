# QOS · Atelier Injection

Application **React + Vite + Tailwind CSS 4**, en français, construite à partir de `QOS - TRS atelier Injection.xlsx`. Le classeur original n’est pas modifié.

## Démarrage

Prérequis : Node.js 22.12 ou plus récent.

```powershell
npm install
npm run dev
```

Ouvrir **http://127.0.0.1:5173**. Le serveur doit rester lancé. Le port 5173 est fixe : si le site est déjà ouvert, réutiliser le serveur existant.

Sans configuration Supabase, le site fonctionne en **mode local**, avec les 16 presses, 3 articles et 63 relevés du classeur. Les modifications sont enregistrées dans le stockage de ce navigateur, pour cette adresse. Un autre navigateur, un autre port ou un autre appareil ne partage pas cette sauvegarde. Exporter les données depuis Configuration avant de vider le navigateur.

## Ce qui est disponible

- Tableau de bord : TRS, disponibilité, performance, qualité, DLE, production, courbes par indicateur, répartition des arrêts, comparaison des presses et des postes.
- Filtres par dates, presse et poste, objectif TRS configurable et mode réunion (Échap pour quitter).
- Saisie quotidienne avec date, poste, presse, moule/article, temps, quantités, rebuts, main-d’œuvre et commentaire.
- Champs blancs manuels ; champs gris automatiques recalculés à chaque modification. Il ne s’agit pas d’une connexion aux automates des presses.
- Historique consultable et modifiable, recherche, pagination et export CSV compatible Excel.
- Ajout, modification et archivage des presses et des moules/articles. L’archivage conserve l’historique.
- Sauvegarde complète JSON, fonctionnement responsive, polices embarquées sans dépendance à Google Fonts.
- En mode Supabase : connexion par email/mot de passe et permissions administrateur, opérateur, consultation.

## Les trois analyses

### Accueil J−1

L’accueil **Bilan J−1** sélectionne la veille réelle selon la date locale de votre ordinateur. La date est modifiable, avec des boutons jour précédent/suivant et un retour J−1. Une journée sans relevé reste vide : elle n’est jamais remplacée silencieusement par la dernière journée saisie.

Le bilan affiche chaque presse et ses postes, les heures de marche, les arrêts (pauses planifiées incluses), les pièces conformes et le TRS. **A travaillé** signifie que du temps machine a été déclaré dans cette journée ; ce n’est pas un état machine en temps réel. **Non renseignée** signifie qu’aucun relevé n’existe, et non que la presse était arrêtée.

Chaque presse renseignée possède sa chronologie : en haut pendant la marche déclarée, en bas pendant les arrêts, avec durée et cause au survol ou au clic. Les journaux renseignés d’une même presse se placent à leurs heures réelles. Les plages sans journal sont hachurées, sans inventer leur état. La liste **Pauses & causes d’arrêt** distingue les événements horaires des simples totaux historiques par catégorie.

La **date de production est la date de début du poste**. Une nuit du 8 octobre à 22 h jusqu’au 9 octobre à 6 h appartient au bilan du 8 octobre. Le graphique et les champs du journal indiquent J+1 pour le lendemain. Les horaires proposés (06 h, 14 h, 22 h) restent modifiables. Le journal accepte les heures avec leur date, ou les minutes depuis le début. Deux relevés horodatés d’une même presse ne doivent pas se chevaucher, même avec des articles ou des dates différents.

La vue d’ensemble, le Pareto et les autres analyses restent accessibles via **Vue d’ensemble**. L’export CSV comprend désormais l’heure de début, l’état du journal et les événements JSON.

L’interface utilise une palette bleu–vert, des icônes Lucide et une presse illustrative en 3D CSS, orientable avec ses boutons. Cette illustration ne reçoit aucune télémétrie machine.

1. **Production & arrêts** : sans horaires, un anneau et une barre interactive présentent les durées réellement enregistrées. Le pourcentage représente le temps de marche divisé par l’ouverture, pas le TRS. Aucun horaire n’est déduit des totaux. Avec un journal complet, cette vue devient une courbe marche/arrêt suivant les horaires saisis, y compris au passage de minuit.
2. **Pareto des arrêts machine** : causes classées par minutes perdues, pourcentage cumulé et repère à 80 %. Les anciens relevés sont regroupés par catégorie ; les journaux détaillés apportent les causes saisies. Les arrêts planifiés sont inclus seulement à la demande.
3. **Temps utile de production** : temps machine déclaré et arrêts par poste, ou par heure pour le relevé dont le journal est complet. Plusieurs presses cumulent des heures machine. Cette durée ne correspond pas au temps théorique des pièces conformes.

Dans la saisie, activer **Utiliser les arrêts horodatés**, renseigner le début du relevé et les débuts/fins d’arrêt en minutes depuis ce début. Les quatre totaux d’arrêt deviennent automatiques. Les plages ne peuvent pas se chevaucher ni dépasser l’ouverture ; les intervalles restants représentent la marche déclarée. Chaque graphique peut être agrandi pour la réunion.

## Installation Supabase

### 1. Créer la base

Créer votre projet sur Supabase. Dans **SQL Editor**, exécuter, dans cet ordre :

1. `supabase/01_schema.sql` : tables, contraintes, calculs, instantanés historiques et politiques d’accès RLS.
2. `supabase/02_import_excel.sql` : données réelles du classeur, sans écraser les lignes existantes.
3. `supabase/03_stop_journal.sql` : horaires, journal des arrêts et validation de leur cohérence avec les totaux.
4. `supabase/04_daily_review.sql` : interdit le chevauchement des relevés horodatés d’une presse, y compris au passage de minuit. Le diagnostic final signale les éventuels conflits antérieurs sans modifier les données.

**Base déjà installée :** si `03_stop_journal.sql` a déjà été exécuté, exécuter seulement `04_daily_review.sql`. Sinon, exécuter `03` puis `04`. Aucun changement du `.env` n’est nécessaire pour cette mise à jour.

Le schéma et l’import peuvent être rejoués. L’import reprend les dates du 1er au 8 octobre 2026, sans inventer de relevés pour le 4 octobre, absent du fichier.

### 2. Créer les utilisateurs

Dans **Authentication → Users**, créer un utilisateur avec email et mot de passe. L’application n’a pas d’inscription publique.

Autoriser ensuite cet utilisateur dans SQL Editor en remplaçant l’email :

```sql
insert into public.workshop_members (user_id, role)
select id, 'admin'
from auth.users
where email = 'votre@email.fr'
on conflict (user_id) do update set role = excluded.role;
```

Rôles :

- `admin` : consulter et saisir la production, gérer les presses et articles.
- `operator` : consulter, saisir et corriger les relevés.
- `viewer` : consulter et exporter.

Tous les membres autorisés partagent **un seul atelier**. Un compte authentifié absent de `workshop_members` ne voit aucune donnée. Les autorisations des membres se gèrent dans SQL Editor, pas depuis le navigateur. Aucune suppression de production n’est exposée par l’application.

### 3. Renseigner `.env`

Le fichier existe déjà à la racine ; `.env.example` en fournit un modèle.

```dotenv
VITE_SUPABASE_URL=https://votre-projet.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_votre_cle_publique
```

L’ancienne clé publique `anon` est aussi compatible. **Ne jamais utiliser `service_role` ou une clé `sb_secret_`** : les variables `VITE_` sont incluses dans le code du navigateur. Les protections reposent sur Supabase Auth et les politiques RLS.

Relancer `npm run dev` après modification du fichier. Le site affiche alors la page de connexion. Un échec Supabase ne provoque jamais un basculement silencieux vers une sauvegarde locale.

Les données du classeur ne sont pas embarquées dans les builds où les variables Supabase sont renseignées. Elles proviennent alors exclusivement de la base après connexion.

### 4. Passer du local au partagé

Le fichier `02_import_excel.sql` importe le classeur d’origine. **Les saisies effectuées ensuite en mode local ne sont pas transférées automatiquement.**

Avant de basculer, exporter la sauvegarde JSON depuis Configuration. Pour générer un SQL de reprise de cette sauvegarde :

```powershell
node scripts/backup-to-sql.mjs "C:\chemin\QOS-sauvegarde.json" "supabase\05_reprise_locale.sql"
```

Lire puis exécuter le fichier généré dans SQL Editor, après `01_schema.sql` et `03_stop_journal.sql`. Pour une reprise complète, préférer une base neuve et utiliser cette reprise à la place de `02_import_excel.sql`. Sur une base déjà remplie, les enregistrements existants sont conservés : les doublons ne sont pas remplacés. La sauvegarde JSON et sa reprise SQL conservent aussi les journaux horaires.

### 5. Mise en ligne

Supabase héberge la base et l’authentification ; le frontend Vite peut être hébergé sur un hébergeur de sites statiques.

```powershell
npm run build
```

Publier le dossier `dist` sur votre hébergement statique, ou configurer le build `npm run build` et le dossier de sortie `dist`. Fournir les deux variables `VITE_` **au moment du build**, puis reconstruire après tout changement de configuration.

Pour vérifier un build localement :

```powershell
npm run preview
```

Le serveur de développement n’est pas un hébergement de production. Aucun compte Supabase réel ni déploiement en ligne n’a été configuré pendant la création ; les identifiants sont volontairement laissés à remplir.

## Analyse et règles du classeur

Le fichier contient quatre feuilles : `Données`, `Saisie_Donnees`, `Dashboard_TRS` et `Parametres_Moules`.

Les 16 presses référencées sont reprises. L’historique comporte 21 relevés pour chacune des presses D140.1, D230.1 et D230.3. Il couvre sept jours et trois postes : Matin, Après-Midi et Nuit.

Les trois articles possèdent huit empreintes : Cover KIKO (39 s/cycle moule, soit 4,875 s/pièce), Base KIKO (38 s, soit 4,75 s/pièce), Insert KIKO (30 s, soit 3,75 s/pièce).

### Saisie manuelle

Date, poste, presse, code moule/article, temps d’ouverture, arrêts planifiés, pannes, démarrage/arrêt, changement de moule, quantité conforme, rebuts démarrage/réglage, rebuts production et heures dépensées. Le commentaire est ajouté pour le suivi des incidents.

### Champs automatiques

La désignation et les temps proviennent de l’article. Les autres calculs reprennent les formules Excel :

```text
Cycle théorique par pièce = cycle du moule / nombre d’empreintes
Temps requis = ouverture − arrêts planifiés
Temps machine = temps requis − pannes − démarrage/arrêt − changement de moule
Quantité totale = conformes + rebuts démarrage + rebuts production
Disponibilité = temps machine / temps requis
Performance = quantité totale × cycle par pièce / (temps machine × 60)
Qualité = conformes / quantité totale
TRS = conformes × cycle par pièce / (temps requis × 60)
Recette (h) = conformes × temps standard / 3600
DLE = recette / heures dépensées
```

Les ratios n’ont pas de valeur quand leur dénominateur est nul. Un poste entièrement planifié à l’arrêt n’affiche pas artificiellement 0 % de TRS. Un poste avec du temps requis mais aucune production affiche 0 % de TRS.

Le TRS ci-dessus équivaut au produit disponibilité × performance × qualité pour une ligne avec production. Une production sans temps machine est interdite. Les temps négatifs, les quantités fractionnaires et les arrêts dépassant l’ouverture sont également interdits.

Les cycles et standards sont conservés **dans chaque relevé**. Modifier les paramètres d’un article ne recalcule pas le passé. Modifier l’article d’un relevé recharge ses nouveaux paramètres. Le SQL applique la même règle côté serveur.

Une combinaison **date + poste + presse + article** est unique. Si une presse fabrique plusieurs articles pendant un poste, répartir les temps et heures entre les relevés ; ne pas répéter la durée complète du poste pour chaque article.

### Corrections de la synthèse

Dans `Dashboard_TRS`, les formules initiales ne pointent que vers les lignes 4 à 6 (postes sans temps requis) et utilisent P-01/P-02/P-03, qui ne correspondent pas aux noms réels. Cela produit des erreurs `#DIV/0!` et des totaux inutilisables.

Le site utilise tous les relevés correspondant aux filtres et les vraies presses. Les taux de synthèse sont pondérés :

- TRS = somme des temps théoriques des pièces conformes / somme des temps requis.
- Disponibilité = somme des temps machine / somme des temps requis.
- Performance = somme des temps théoriques de toutes les pièces / somme des temps machine.
- Qualité = somme des conformes / somme des quantités totales.
- DLE = somme des recettes / somme des heures dépensées.

Avec plusieurs cycles différents, multiplier les trois taux agrégés ne donne pas nécessairement le TRS agrégé. Le TRS est donc calculé directement depuis les temps théoriques.

Sur le classeur original : **219 520 pièces conformes**, **1 250 rebuts**, **311,5 heures machine**, **TRS de 80,7 %**. Treize relevés ont une performance supérieure à 100 % ; les valeurs sont conservées et signalées. L’objectif initial de 85 % est une proposition configurable, absent du fichier d’origine.

## Vérifications

```powershell
npm test
npm exec playwright test
npm run build
```

Les tests UI nécessitent que `npm run dev` soit lancé sur le port 5173 et utilisent Microsoft Edge en mode headless dans un contexte isolé.

- Comparaison de dix résultats calculés avec les valeurs Excel pour les 63 lignes.
- Cas sans production, ratios au-delà de 100 %, pondération et validations.
- Exécution du SQL sur PostgreSQL embarqué PGlite : réexécution, import, ratios, contraintes, politiques RLS et instantanés historiques.
- Parcours UI : saisie, rechargement persistant, modification, export, ajout de références, filtres et mode réunion.
- Affichage mobile à 390 px, saisie et absence de débordement global.

La connexion réseau à un projet Supabase réel reste à valider après renseignement de vos identifiants. PGlite teste les règles PostgreSQL avec des identités simulées, pas le service Auth hébergé.

## Structure

`src/` contient l’interface, les calculs, le stockage et la reprise Excel. `supabase/` contient le schéma et l’import. `scripts/` contient l’extraction en lecture seule du classeur et les utilitaires. `tests/` contient les vérifications métier, SQL et UI.

Références techniques : [variables d’environnement Vite](https://vite.dev/guide/env-and-mode), [clés publiques Supabase](https://supabase.com/docs/guides/getting-started/api-keys), [connexion Supabase](https://supabase.com/docs/reference/javascript/auth-signinwithpassword), [protection des données](https://supabase.com/docs/guides/database/secure-data).
