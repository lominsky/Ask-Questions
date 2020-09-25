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
	for(i in posts) {
		let post = posts[i];
		let timestamp = new Date(post.timestamp);

		let card = $("<div></div>").addClass("card mb-2").attr("postId", post.id).attr("timestamp", post.timestamp);
		
		let cardBody = $("<div></div>").addClass("card-body");
		let question = $("<p></p>").addClass("card-text question-text").text(post.question);
		let ts = $("<p></p>").addClass("card-text timestamp").text("Asked " + timestamp.toLocaleDateString() + " at " + timestamp.toLocaleTimeString());
		
		let feedback = $("<div></div>").addClass("feedback-box");
		let like = $("<span></span>").addClass("like").click(toggleLike);
		let likeCount = Object.keys(post.likes).length;
		let thumbsUp = $("<i></i>").attr("data-feather","thumbs-up");
		let gq = $("<span></span>").text("Good Question (" + likeCount + ")");
		let hash = getHash(timestamp.getTime())
		if(post.likes[hash]) like.addClass("active");
		like.append(thumbsUp, gq);
		feedback.append(like);
		cardBody.append(question, ts, feedback);

		let responses = $("<div></div>").addClass("mt-3");
		for(i in post.responses) {
			let resp = post.responses[i];
			// console.log(resp)
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
	feather.replace()
}

function respond(e) {
	// console.log(e);
	let div = e.target.parentElement;
	let box = div.parentElement.parentElement

	let postId = $(box).attr("postId");
	let response = $(div).find("textarea").val()

	if(response.length < 2) return false;

	$(div).find("textarea").val("")
	firebase.database().ref("posts/responses/" + postId).push({
		answer: response,
		user: user.displayName,
		timestamp: (new Date()).getTime()
	})
	// console.log(postId, response);
}

function toggleLike(e) {
	let span = e.target
	let box = span.parentElement.parentElement.parentElement.parentElement;
	let postId = $(box).attr('postId');
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

function getHash(timestamp) {
	return md5(user.uid + timestamp);
}