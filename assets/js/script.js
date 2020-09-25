// Your web app's Firebase configuration
var firebaseConfig = {
	apiKey: "AIzaSyDA9LFO_QJaMbb7JoxsBX0f8Y8_bAl0RSc",
	authDomain: "ask-5cf85.firebaseapp.com",
	databaseURL: "https://ask-5cf85.firebaseio.com",
	projectId: "ask-5cf85",
	storageBucket: "ask-5cf85.appspot.com",
	messagingSenderId: "401055363485",
	appId: "1:401055363485:web:e1bb704da7e44afd82ff74"
};
// Initialize Firebase
firebase.initializeApp(firebaseConfig);
var provider = new firebase.auth.GoogleAuthProvider();
provider.setCustomParameters({
   prompt: 'select_account'
});
var user = null;
var posts = [];
$(".view").hide();


firebase.auth().onAuthStateChanged(function(u) {
  if (u) {
  	user = u;
  	user.isAdmin = false;
  	getPosts();
  	firebase.database().ref("adminTest").once("value", function(snapshot){
  		user.isAdmin = true;
  		$('.admin-only').show();
  	});
  } else {
  	user = null;
  	setDisplay("login");
  }
});

function login() {
	firebase.auth().signInWithPopup(provider);
}

function logoutAccount() {
	firebase.auth().signOut();
}

function setDisplay(val) {
	$(".view").hide();
	$("[view='" + val + "']").show();
}

function ask() {
	let field = $('#questionTextArea');
	let question = field.val();
	if(question.length < 3) return false;
	field.val("");

	let now = (new Date()).getTime();
	let post = {
		question: question,
		timestamp: now,
		user: getHash(now)
	}
	firebase.database().ref("posts/questions").push(post);
}

function getPosts() {
	firebase.database().ref("posts").on("value", function(snapshot) {
		let data = snapshot.val();
		posts = [];
		if(data == null) data = {};
		if(data.posts == null) data.posts = {};
		if(data.likes == null) data.likes = {};
		if(data.responses == null) data.responses = {};
		for(i in data.questions) {
			let question = data.questions[i];
			if(question.hidden == true) continue;
			question.id = i;
			if (data.likes[i] == null) {
				question.likes = {};
			} else {
				question.likes = data.likes[i];
			}
			if (data.responses[i] == null) {
				question.responses = {};
			} else {
				question.responses = data.responses[i];
			}

			//Check if the user liked the question or if it's their question
			let hash = getHash(question.timestamp);
			question.isLiked = false;
			for(i in question.likes) {
				if(i == hash) {
					question.isLiked = true;
				}
			}
			question.isOwner = question.user == hash;
			posts.push(question);
		}
		displayPosts();
	  	setDisplay("main");
	}, function(error) {
		// console.log(error);
	  	setDisplay("login");
	});
}

function displayPosts() {
	$("#postDiv").empty();

	//Filter for likes then responses
	let filteredPosts = posts.filter(post => (post.isLiked && filter.liked || !post.isLiked && filter.unliked));
	filteredPosts = filteredPosts.filter(post => (Object.keys(post.responses).length == 0 && filter.unanswered || Object.keys(post.responses).length > 0 && filter.answered));
	filteredPosts = filteredPosts.filter(post => post.question.toLowerCase().includes(filter.search))
	filteredPosts = posts.filter(post => (post.isOwner && filter.isOwner || !post.isOwner && filter.notOwner));

	//Sort
	filteredPosts.sort(function(a, b) {
		if(filter.sortCategory == "likeCount") {
			a.likeCount = Object.keys(a.likes).length;
			b.likeCount = Object.keys(b.likes).length;
		}
		let descending = 1;
		if(!filter.descending) descending = -1;
		return (b[filter.sortCategory] - a[filter.sortCategory]) * descending;
	});

	for(i in filteredPosts) {
		let post = filteredPosts[i];
		let timestamp = new Date(post.timestamp);

		let card = $("<div></div>").addClass("card mb-2").attr("id", post.id).attr("timestamp", post.timestamp);
		
		let cardBody = $("<div></div>").addClass("card-body");
		let question = $("<p></p>").addClass("card-text question-text").text(post.question);
		let ts = $("<p></p>").addClass("card-text timestamp").text("Asked " + timestamp.toLocaleDateString() + " at " + timestamp.toLocaleTimeString());
		
		let feedback = $("<div></div>").addClass("feedback-box");
		let like = $("<span></span>").addClass("like").click(toggleLike);
		let likeCount = Object.keys(post.likes).length;
		let thumbsUp = $("<i></i>").attr("data-feather","thumbs-up");
		let gq = $("<span></span>").text("Good Question (" + likeCount + ")");
		if(post.isLiked) like.addClass("active");
		like.append(thumbsUp, gq);
		feedback.append(like);
		cardBody.append(question, ts, feedback);

		let responses = $("<div></div>").addClass("mt-3");
		for(i in post.responses) {
			let resp = post.responses[i];
			let div = $("<div></div>").addClass("mb-1")
			let answerer = $("<div></div>").addClass("answer-user").text(resp.user);
			let time = $("<div></div>").addClass("answer-time").text((new Date(resp.timestamp)).toLocaleString());
			let answer = $("<div></div>").addClass("answer-text").text(resp.answer);
			div.append(answerer, answer, time);
			responses.append(div);
		}
		if($(responses).html != "") cardBody.append(responses);

		let response = $("<div></div>").addClass("response-box admin-only").hide();
		if(user.isAdmin) response.show();
		let inputGroup = $("<div></div>").addClass("input-group mt-3 mb-3");
		let textarea = $("<textarea></textarea>").addClass("form-control").attr("rows", "4");
		// let br = $("<br>");
		let button = $("<button></button>").addClass("respond").attr("type", "button").attr("rel", "no-refresh").text("Answer").click(respond);
		inputGroup.append(textarea);
		response.append(inputGroup, button);

		

		cardBody.append(response);
		card.append(cardBody);
		$("#postDiv").append(card);
	}
	if(filteredPosts.length == 0) {
		$("#postDiv").append("<div><h3>Sorry, there are no questions that match your filter criteria.</h3></div>");
	}
	feather.replace()
}

function respond(e) {
	let div = e.target.parentElement;
	let box = div.parentElement.parentElement

	let postId = $(box).attr("id");
	let response = $(div).find("textarea").val()

	if(response.length < 2) return false;

	$(div).find("textarea").val("")
	firebase.database().ref("posts/responses/" + postId).push({
		answer: response,
		user: user.displayName,
		timestamp: (new Date()).getTime()
	})
}

function toggleLike(e) {
	let span = e.target
	let box = span.parentElement.parentElement.parentElement.parentElement;
	let postId = $(box).attr('id');
	let timestamp = $(box).attr('timestamp');
	let hash = getHash(timestamp);
	let ref = firebase.database().ref("posts/likes/" + postId + "/" + hash);
	let active = $(span.parentElement).hasClass('active');

	if(active) {
		ref.remove();
	} else {
		ref.set((new Date()).getTime());
	}
}

let filter = {
	liked: true,
	unliked: true,
	answered: true,
	unanswered: true,
	isOwner: true,
	notOwner: true,
	sortCategory: "timestamp",
	descending: true,
	search: ""
}
function updateFilters() {
	let filters = $("#filters").find('input');
	filter.liked = filters[0].checked;
	filter.unliked = filters[1].checked;
	filter.answered = filters[2].checked;
	filter.unanswered = filters[3].checked;
	filter.isOwner = filters[4].checked;
	filter.notOwner = filters[5].checked;

	let sorts = $("#sorts").find('input');
	if(sorts[0].checked) filter.sortCategory = "timestamp";
	if(sorts[1].checked) filter.sortCategory = "likeCount";
	if(sorts[2].checked) filter.descending = false;
	if(sorts[3].checked) filter.descending = true;

	search();
}

function search() {
	filter.search = $("#searchBar").val().toLowerCase();
	displayPosts();
}

function getHash(timestamp) {
	return md5(user.uid + timestamp);
}