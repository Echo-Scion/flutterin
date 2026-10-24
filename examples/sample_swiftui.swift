VStack {
    Text("SwiftUI to Flutter")
        .font(.title)
        .bold()
    Text("Seamlessly convert iOS views into Flutter widgets")
        .font(.subheadline)
    TextField("Username", text: $username)
    Button("Submit") {
        print("Tapped")
    }
}
.padding(20)
