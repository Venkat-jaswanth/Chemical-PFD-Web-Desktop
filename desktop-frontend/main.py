import sys
from PyQt5.QtWidgets import QApplication, QStackedWidget
from PyQt5.QtCore import Qt, QCoreApplication

from src.db import create_db_table
import src.app_state as app_state
from src.screens import WelcomeScreen, LoginScreen, CreateAccScreen


def main():
    create_db_table("app_users.db")

    # high-DPI awareness
    QCoreApplication.setAttribute(Qt.AA_EnableHighDpiScaling, True)
    QCoreApplication.setAttribute(Qt.AA_UseHighDpiPixmaps, True)


    app = QApplication(sys.argv)
    QApplication.setStyle('Fusion')

    stacked = QStackedWidget()
    stacked.setMinimumSize(1200, 800)

    # open maximized or fullscreen
    stacked.showMaximized()   # or 
    # stacked.showFullScreen()

    # Expose stacked widget globally for navigation/toast
    app_state.widget = stacked

    welcome = WelcomeScreen()
    login = LoginScreen()
    create = CreateAccScreen()

    stacked.addWidget(welcome)  # index 0
    stacked.addWidget(login)    # index 1
    stacked.addWidget(create)   # index 2

    stacked.setCurrentIndex(0)
    stacked.show()

    sys.exit(app.exec_())


if __name__ == "__main__":
    main()
