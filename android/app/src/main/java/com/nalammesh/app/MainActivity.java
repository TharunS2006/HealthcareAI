package com.nalammesh.app;

import android.os.Bundle;
import android.view.WindowManager;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Patient records are on this screen. FLAG_SECURE keeps them out of
        // screenshots, screen recordings, casting to an untrusted display and
        // the recent-apps thumbnail, where anyone picking up the phone could
        // read the last record without unlocking anything.
        getWindow().setFlags(WindowManager.LayoutParams.FLAG_SECURE, WindowManager.LayoutParams.FLAG_SECURE);
    }
}
