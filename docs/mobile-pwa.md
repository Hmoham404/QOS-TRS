# QOS : quantité planifiée, accès direct et mobile

## Mise à jour du 23 octobre 2026

Le site propose FR, AR, EN, IT et 中文 sur les sept écrans, avec persistance de la langue et disposition de droite à gauche pour l’arabe. Le sélecteur de l’atelier donne accès à Injection et aux espaces vides Assemblage, Soudure, Métallisation et Sérigraphie. Ces quatre espaces ne sont pas encore reliés à une base métier.

L’export `.xlsx` contient une synthèse et les relevés du périmètre sélectionné. Il reste disponible hors connexion après préparation du cache PWA. Le nouvel APK 1.1.0 (`versionCode` 2) gère les fichiers binaires Excel, avec la même identité de signature ; l’APK 1.0 nécessite cette mise à jour pour l’export Excel.

Vérifications locales de cette évolution : **30 tests métier/SQL/Excel, 18 parcours navigateur, 5 scénarios PWA et build réussis**. La signature de l’APK a été vérifiée. Les tests incluent la saisie dans les cinq langues, la reprise après changement de langue, l’absence de mélange entre départements, le téléchargement et la relecture des classeurs, le pont d’export Android simulé et l’export Excel hors connexion. Les tests UI utilisent désormais un serveur dédié sur le port 5175, avec Supabase désactivé. Aucun essai d’écriture sur une base de production ni installation sur téléphone physique n’a été effectué. Cette vérification ne constitue pas une publication.

## Mise à jour de la base existante

Dans Supabase → SQL Editor, ouvrir et exécuter **tout** le fichier
[`supabase/05_planning_public_access.sql`](../supabase/05_planning_public_access.sql).
Il s'exécute après `01_schema.sql`, `03_stop_journal.sql` et `04_daily_review.sql`.
Sur une base déjà en service avec ces migrations, ne pas réimporter `02_import_excel.sql`.
Pour une nouvelle base, exécuter `01`, éventuellement `02` pour reprendre le classeur,
puis `03`, `04` et `05`.

Pour les nouvelles causes de pertes, appliquer ensuite [`supabase/06_loss_categories.sql`](../supabase/06_loss_categories.sql). Si les migrations précédentes sont déjà installées, seule `06` est nécessaire. Les anciens relevés restent inchangés ; les nouveaux champs démarrent à zéro.

La migration est rejouable. Elle ajoute `production_records.planned_qty`, facultatif,
entier positif ou nul. Les anciens relevés gardent NULL (« non renseignée »).
Zéro signifie bien zéro prévu. Le champ appartient à chaque relevé : date, poste,
presse et article. Si plusieurs articles partagent un poste, répartir le plan entre
leurs relevés. Les formules TRS et DLE restent inchangées.

Le plan apparaît dans la saisie, sa synthèse et l'historique, ainsi que dans les
exports CSV, JSON et la reprise SQL. Le taux de réalisation affiché est
`quantité conforme / quantité planifiée`, non calculable si le plan est nul ou absent.

## Ouverture sans connexion

L'application n'affiche plus de page de connexion et ne réutilise pas les anciennes
sessions Supabase. La migration donne aux visiteurs l'accès en lecture, ajout et
modification des presses, articles et relevés. **Toute personne disposant du lien
et de la clé publique peut accéder à l'atelier.** Ce mode ne permet pas d'identifier
l'auteur d'une nouvelle saisie. La suppression et la gestion des membres ne sont
pas ouvertes. La RLS, les contraintes de temps, les journaux et la conservation des
cycles historiques restent actives.

## Base commune entre les appareils

Renseigner au moment du build :

```dotenv
VITE_SUPABASE_URL=https://VOTRE-PROJET.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=VOTRE_CLE_PUBLIQUE
```

Utiliser l'URL du projet, sans `/rest/v1/` (les anciennes URL REST sont normalisées).
`VITE_SUPABASE_ANON_KEY` reste accepté comme autre nom pour la clé publique.
Utiliser une clé publishable ou une ancienne clé anon publique, jamais une clé
secrète ni service_role. Si les deux valeurs sont absentes, le mode local est
conservé. Une configuration partielle ou d'exemple affiche une erreur explicite.

Les écritures en ligne vont directement dans Supabase. Les autres appareils
rechargent les données lors du retour à l'application et chaque minute quand une
vue de consultation est visible. Le bouton Actualiser reste disponible. La saisie
en cours n'est pas remplacée par ces actualisations. Une modification concurrente
d'un relevé est refusée grâce à sa date `updated_at` ; le brouillon est conservé.

## Publication HTTPS sur Vercel

Le fichier `vercel.json` configure Vite, le dossier `dist`, les routes et les
en-têtes de cache du service worker.

1. Importer ce dépôt dans le projet Vercel destiné à cet atelier.
2. Ajouter les deux variables ci-dessus dans l'environnement de production.
3. Publier avec la commande de build `npm run build`, sortie `dist`.
4. Ouvrir l'URL HTTPS publiée et vérifier les données communes sur deux appareils.

Une connexion au compte Vercel et les valeurs publiques du projet Supabase sont
nécessaires pour effectuer réellement cette publication. Modifier les fichiers
sur le PC ne met pas à jour les téléphones : chaque version doit être republiée.

## Installation

- Android, PWA : ouvrir l'URL HTTPS dans Chrome/Edge, puis **Installer depuis le navigateur**.
  Le bouton déclenche la confirmation native quand le navigateur l'autorise.
  Sinon, les instructions indiquent le menu Installer / Ajouter à l'écran d'accueil.
- iPhone/iPad : ouvrir dans Safari, menu de partage, **Sur l'écran d'accueil**,
  puis **Ajouter**. Activer « Ouvrir comme app » si cette option est présentée.
- Ordinateur : bouton d'installation ou menu du navigateur compatible.

### APK Android distinct

Le bouton **Télécharger l'APK Android** télécharge directement
`https://qos-trs.vercel.app/downloads/qos-injection.apk`. Ouvrir ensuite le fichier,
autoriser ce navigateur à installer une application si Android le demande, puis
confirmer. Le site ne peut pas confirmer l'installation à la place de l'utilisateur.
Cet APK signé fonctionne à partir d'Android 8 ; il ne fonctionne pas sur iPhone.

L'APK est un client WebView HTTPS du site principal, avec stockage des brouillons,
sélection de fichiers et enregistrement des exports via le sélecteur Android.
Il demande uniquement l'accès Internet. Une première ouverture en ligne est
nécessaire. Les données enregistrées vont dans la même base ; les brouillons de
l'APK et du navigateur restent séparés. Les mises à jour du dashboard arrivent
par le site et son service worker. Une modification du client Android nécessite
un nouvel APK signé avec la même clé et un `versionCode` supérieur.

Sources : `android/`. Compilation : `node scripts/build-android.mjs`, avec JDK 21,
Android SDK Platform 35 et Build Tools 35.0.0 dans `.runtime/android-tools/`
(ou chemins personnalisés via les variables indiquées dans le script).
La signature et le certificat sont vérifiés par `apksigner`. L'empreinte du fichier
est publiée dans `/downloads/qos-injection.apk.sha256`.

**Sauvegarder en lieu sûr le dossier `.android-signing/`**, contenant la clé et
son mot de passe. Il est exclu de Git et des déploiements Vercel ; il permet de
publier les futures mises à jour Android sans changer l'identité de l'application.

## Hors connexion, brouillons et mises à jour

Après une première ouverture en ligne et l'installation du service worker, les
écrans, scripts, styles et polices sont disponibles hors connexion. En mode partagé,
la dernière consultation réussie de Supabase est gardée sur cet appareil et sa date
est affichée si le réseau est indisponible. Une erreur SQL ou de permissions ne
provoque pas un basculement silencieux sur les données du classeur.

Chaque modification d'une saisie conserve immédiatement son brouillon dans le
stockage du navigateur, avec le plan, les arrêts et le contexte du relevé. Reprendre
une saisie depuis **Saisie de production → Brouillons sur cet appareil**. Après
enregistrement réussi, son brouillon est retiré. Les brouillons sont isolés par
base et restent propres à cet appareil. Un stockage plein ou indisponible est
signalé. Effacer les données du navigateur supprime aussi ses brouillons.

En mode partagé hors connexion, les brouillons restent modifiables, mais il faut
revenir en ligne et cliquer Enregistrer pour les envoyer. Il n'y a pas de file
d'envoi automatique susceptible d'écraser une modification d'un autre appareil.
En mode local, les relevés restent enregistrables sans réseau.

Chaque build génère un cache versionné à partir du contenu des ressources. Une
nouvelle version est installée entièrement avant d'être proposée. Elle attend le
bouton **Mettre à jour** pour remplacer l'ancienne version ouverte. Les brouillons
ne sont pas stockés dans ce cache et sont conservés. Si un brouillon n'a pas pu être
écrit, la mise à jour depuis son formulaire est bloquée jusqu'à l'enregistrement.

## Vérifications reproductibles

```powershell
npm test
# Le serveur local est démarré automatiquement si nécessaire :
npm exec playwright test
npm run build
npm exec playwright test -- --config=playwright.pwa.config.js
```

La suite PWA sert le build sur le port local 4173 et simule une seconde publication,
sans modifier `dist`. Les tests couvrent le manifeste, les ressources hors connexion,
la conservation et reprise des brouillons, la mise à jour volontaire, le parcours
iPhone affiché, un événement d'installation natif simulé et le téléchargement
effectif de l'APK avec le service worker actif.

Ces tests utilisent Microsoft Edge automatisé avec des dimensions mobiles et un
agent utilisateur iPhone pour les instructions. Ils ne remplacent pas un essai
d'installation sur un vrai Android/iPhone. Les tests SQL utilisent PostgreSQL
embarqué PGlite. Le 16 octobre 2026 : 22 tests métier/SQL, 7 parcours UI et 4 tests
PWA réussis. Les deux sites `qos-trs.vercel.app` et `qos-trs-4qyl.vercel.app` ont
été publiés puis contrôlés : accès sans login, réponses Supabase HTTP 200,
16 presses, champ quantité planifiée, reprise du brouillon après rechargement,
absence de débordement à 390 px et téléchargement de l'APK dont l'empreinte
correspond au fichier signé. Aucun relevé de test n'a été ajouté à la base réelle.
La signature APK a été vérifiée par les outils Android ; l'exécution et
l'installation sur un téléphone Android physique restent à tester.

Documentation : [installation PWA](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable),
[cycle de mise à jour](https://web.dev/learn/pwa/update),
[Vite sur Vercel](https://vercel.com/docs/frameworks/frontend/vite).
