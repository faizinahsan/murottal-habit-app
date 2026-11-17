package com.murottal.murottal

import com.ryanheise.audioservice.AudioServiceActivity

// AudioServiceActivity keeps the Flutter engine shared with the background audio service,
// so playback and lock-screen controls survive the screen turning off.
class MainActivity : AudioServiceActivity()
